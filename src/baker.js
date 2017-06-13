/**
 * TODO: reinstall ansible vm is implemented, but doesn't copy know private keys to the new ansible server
 */
const path = require('path');
const fs = require('fs-extra');
const vagrant = require('node-vagrant');
const argv = require('yargs').argv;
const scp2 = require('scp2');
const ssh2 = require('ssh2');
const Client = require('ssh2').Client;
const yaml = require('js-yaml');
const prompt = require('prompt');
const mustache = require('mustache');
const chalk = require('chalk');

var child_process = require('child_process');

var boxes = path.join(require('os').homedir(), '.baker');
var ansible = path.join(boxes, 'ansible-srv');

async function main() {
    if (!fs.existsSync(boxes)) {
        fs.mkdirSync(boxes);
    }
    if (!fs.existsSync(ansible)) {
        fs.mkdirSync(ansible);
    }

    if (argv.install) await installAnsibleServer();
    else if (argv.reinstall) await reinstallAnsibleServer();
    else {
        let ansibleVM = await prepareAnsibleServer(argv.script);
        let sshConfig = await getSSHConfig(ansibleVM);
        bake('test', sshConfig, ansibleVM);
    }
}

main();

/**
 * get State of a vagrant vm by id.
 * @param {String} id
 */
async function getState(id) {
    return new Promise((resolve, reject) => {
        vagrant.globalStatus(function(err, out) {
            if( err )
                chalk.red(err);
            out.forEach(vm => {
                if (vm.id == id) resolve(vm.state);
            });
        });
    });
}

/**
 * get vagrant id of ansible server
 */
async function getAnsibleSrvVagrantId() {
    return new Promise((resolve, reject) => {
        vagrant.globalStatus(function(err, out) {
            out.forEach(vm => {
                if (/ansible-srv/.test(vm.cwd)) {
                    resolve(vm.id);
                }
            });
            resolve(undefined);
        });
    });
}

/**
 * Checks if ansible server is up, if not it starts the server
 * It will also copy new vm's ansible script to ~/baker/{name}/ in ansible server
 * Returns a promise, use cleaner es7 syntax:
 * Resolves the ansible machine
 * ------
 * await prepareAnsibleServer()
 * ...do something after finished preparing server
 * ------
 */
async function prepareAnsibleServer(bakerScriptPath) {
    let machine = vagrant.create({ cwd: ansible });
    let doc = yaml.safeLoad(fs.readFileSync(path.join(argv.script, 'baker.yml'), 'utf8'));
    let ansibleSSHConfig = await getSSHConfig(machine);

    // if(await getAnsibleSrvVagrantId() == undefined)
    //     // TODO
    if ((await getState(await getAnsibleSrvVagrantId())) != 'running') {
        console.log(chalk.green('==> Starting ansible server...'));
        return new Promise((resolve, reject) => {
            machine.up(async function(err, out) {
                // console.log( out );
                console.log(
                    err || chalk.green('==> Ansible server is now ready!')
                );

                // Copying ansible script to ansible vm
                if(bakerScriptPath != undefined){
                    await copyFromHostToVM(
                        path.resolve(argv.script,doc.bake.ansible.source),
                        `/home/vagrant/baker/${doc.name}`,
                        ansibleSSHConfig,
                        false
                    );
                }

                resolve(machine);
            });

            machine.on('up-progress', function(data) {
                verbose(data);
            });
        });
    } else {
        console.log(chalk.green('==> Ansible server is now ready!'));
        if(bakerScriptPath != undefined){
            await copyFromHostToVM(
                path.resolve(argv.script,doc.bake.ansible.source),
                `/home/vagrant/baker/${doc.name}`,
                ansibleSSHConfig,
                false
            );
        }
        return machine;
    }
}

/**
 * Destroy a vagrant vm sync
 * @param {String} id
 */
function destroyVM(id) {
    console.log(chalk.green('==> Destroying ansible server...'));
    child_process.execSync(`vagrant destroy ${id}`, { stdio: 'inherit' });
}

/**
 * Creates ansible server, if already doesn't exist
 */
async function installAnsibleServer() {
    if ((await getAnsibleSrvVagrantId()) != undefined) {
        console.log(chalk.green('==> Ansible server already provisioned...'));
        prepareAnsibleServer();
        return;
    } else {
        let machine = vagrant.create({ cwd: ansible });
        let template = fs.readFileSync('./config/AnsibleVM.mustache', 'utf8');
        let vagrantfile = mustache.render(template, require('./config/AnsibleVM'));
        fs.writeFileSync(path.join(ansible, 'Vagrantfile'), vagrantfile)

        fs.copySync(
            path.resolve(__dirname, './config/provision.shell.sh'),
            path.resolve(ansible, 'provision.shell.sh')
        );

        console.log(chalk.green('==> Creating ansible server...'));

        machine.up(function(err, out) {
            // console.log( out );
            if (err) throw `==> Couldn't start ansible server!!`;
            else
                console.log(
                    chalk.green('==> Ansible server is now ready!')
                );
            return;
        });

        machine.on('up-progress', function(data) {
            verbose(data);
        });
    }
}

/**
 * Re-installs ansible server.
 * @returns Promise
 */
async function reinstallAnsibleServer() {
    destroyVM(await getAnsibleSrvVagrantId());
    await installAnsibleServer();
}

/**
 * Get ssh configurations
 * @param {Obj} machine
 */
async function getSSHConfig(machine) {
    return new Promise((resolve, reject) => {
        machine.sshConfig(function(err, sshConfig) {
            // console.log( err || "ssh info:" );
            if (sshConfig && sshConfig.length > 0) {
                // callback(sshConfig[0])
                resolve(sshConfig[0]);
            } else {
                // callback(err);
                throw `==> Couldn't get private ssh key of new VM`; // err
            }
        });
    });
}

async function copyFromHostToVM(src, dest, destSSHConfig, chmod_=true) {
    scp2.scp(
        src,
        {
            host: '127.0.0.1',
            port: destSSHConfig.port,
            username: destSSHConfig.user,
            privateKey: fs.readFileSync(destSSHConfig.private_key, 'utf8'),
            path: dest
        },
        function(err) {
            if (err)
                console.log(chalk.bold.red(`==> Failed to configure ssh keys: ${err}`));
            if(chmod_) chmod(dest, destSSHConfig);
            return;
        }
    );
}

/**
 * chmod 600 the key files on ansible server,
 * add the key to agent,
 * and add the host url to /etc/hosts
 *
 * @param {String} key path to the key on server
 * @param {Object} sshConfig
 */
function chmod(key, sshConfig) {
    var c = new Client();
    c
        .on('ready', function() {
            c.exec(`chmod 600 ${key} && eval "$(ssh-agent -s)" && ssh-add ${key}`, function(err, stream) {
                if (err) throw err;
                stream
                    .on('close', function(code, signal) {
                        console.log(
                            'Stream :: close :: code: ' +
                                code +
                                ', signal: ' +
                                signal
                        );
                        c.end();
                    })
                    .on('data', function(data) {
                        console.log('STDOUT: ' + data);
                    })
                    .stderr.on('data', function(data) {
                        console.log('STDERR: ' + data);
                    });
            });
        })
        .connect({
            host: '127.0.0.1',
            port: sshConfig.port,
            username: sshConfig.user,
            privateKey: fs.readFileSync(sshConfig.private_key)
        });
}

/**
 * Adds the host url to /etc/hosts
 *
 * @param {String} ip
 * @param {String} name
 * @param {Object} sshConfig
 */
async function addToAnsibleHosts(ip, name, sshConfig){
    var c = new Client();
    c
        .on('ready', function() {
            c.exec(`ansible all -i "localhost," -m lineinfile -a "dest=/etc/hosts line='${ip} ${name}' state=present" -c local --become`, function(err, stream) {
                if (err) throw err;
                stream
                    .on('close', function(code, signal) {
                        // console.log(
                        //     'Stream :: close :: code: ' +
                        //         code +
                        //         ', signal: ' +
                        //         signal
                        // );
                        c.end();
                        return;
                    })
                    .on('data', function(data) {
                        // console.log('STDOUT: ' + data);
                    })
                    .stderr.on('data', function(data) {
                        console.log('STDERR: ' + data);
                    });
            });
        })
        .connect({
            host: '127.0.0.1',
            port: sshConfig.port,
            username: sshConfig.user,
            privateKey: fs.readFileSync(sshConfig.private_key)
        });
}

// TODO: Need to be cleaning cmd so they don't do things like
// ; sudo rm -rf / on our server...
async function runAnsiblePlaybook(doc, cmd, sshConfig)
{
    var c = new Client();
    c
        .on('ready', function() {
            let execStr = `cd /home/vagrant/baker/${doc.name} && ansible-playbook -i ${doc.name} ${cmd}`;
            console.log( execStr );
            c.exec(execStr, function(err, stream) {
                if (err) throw err;
                stream
                    .on('close', function(code, signal) {
                        c.end();
                        return;
                    })
                    .on('data', function(data) {
                        // console.log('STDOUT: ' + data);
                    })
                    .stderr.on('data', function(data) {
                        console.log('STDERR: ' + data);
                    });
            });
        })
        .connect({
            host: '127.0.0.1',
            port: sshConfig.port,
            username: sshConfig.user,
            privateKey: fs.readFileSync(sshConfig.private_key)
        });
}

async function promptValue(propertyName, description) {
    return new Promise((resolve, reject) => {
        prompt.start();
        prompt.get([{ name: propertyName, description: description }], function(
            err,
            result
        ) {
            if (err) {
                console.log(chalk.bold.red(err));
            }
            //prompt.stop();
            resolve(result[propertyName]);
        });
    });
}

/**
 * Traverse yaml and do prompts
 */
async function traverse(o) {
    const stack = [{ obj: o, parent: null, parentKey: '' }];

    while (stack.length) {
        const s = stack.shift();
        const obj = s.obj;
        const parent = s.parent;
        const parentKey = s.parentKey;

        for (var i = 0; i < Object.keys(obj).length; i++) {
            let key = Object.keys(obj)[i];

            //await fn(key, obj[key], obj)

            if (obj[key] instanceof Object) {
                stack.unshift({ obj: obj[key], parent: obj, parentKey: key });
            }

            if (key == 'prompt') {
                const input = await promptValue(parentKey, obj[key]);
                // Replace "prompt" with an value provided by user.
                parent[parentKey] = input;
            }
        }
    }
    return o;
}

async function initVagrantFile(path, doc, template) {
    const vagrant = doc.vagrant;
    await traverse(vagrant);
    const output = mustache.render(template, doc);

    fs.writeFileSync(path, output);
}

function verbose(details) {
    if (argv.verbose || argv.v) {
        console.log(details);
    }
}

async function bake(name, ansibleSSHConfig, ansibleVM) {
    let dir = path.join(boxes, name);
    let template = fs.readFileSync('./config/BaseVM.mustache').toString();

    // TODO: Use version fetched from github.
    let doc = yaml.safeLoad(fs.readFileSync(path.join(argv.script, 'baker.yml'), 'utf8'));

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    let machine = vagrant.create({ cwd: dir });

    await initVagrantFile(path.join(dir, 'Vagrantfile'), doc, template);
    console.log(chalk.green('==> Baking vm...'));

    machine.up(async function(err, out) {
        console.log(err || chalk.green('==> New VM is ready'));
        let sshConfig = await getSSHConfig(machine);
        await copyFromHostToVM(
            sshConfig.private_key,
            `/home/vagrant/baker/${doc.name}/id_rsa`,
            ansibleSSHConfig
        );
        await addToAnsibleHosts(
            doc.vagrant.network.find((item)=>item.private_network!=undefined).private_network.ip,
            doc.name,
            ansibleSSHConfig
        )
        console.log(chalk.green('==> Running Ansible playbooks'));        
        console.log( doc.bake.ansible.playbooks );
        for( var i = 0; i < doc.bake.ansible.playbooks.length; i++ )
        {
            var cmd = doc.bake.ansible.playbooks[i];
            await runAnsiblePlaybook(
                doc, cmd, ansibleSSHConfig
            )
        }
    });

    machine.on('up-progress', function(data) {
        //console.log(machine, progress, rate, remaining);
        verbose(data);
    });
}
