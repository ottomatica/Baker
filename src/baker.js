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
var tmp = require('tmp');
const slash = require("slash");

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
    else if(argv.ssh){
        bakerSSH(argv.ssh);
    }
    else {
        let ansibleVM;
        if(argv.script){
            ansibleVM = await prepareAnsibleServer(argv.script);
            let sshConfig = await getSSHConfig(ansibleVM);
            bake(sshConfig, ansibleVM, argv.script);
        }
        else if (argv.repo){
            let localRepoPath = await cloneRepo(argv.repo);
            ansibleVM = await prepareAnsibleServer(localRepoPath);
            let sshConfig = await getSSHConfig(ansibleVM);
            bake(sshConfig, ansibleVM, localRepoPath);
        }
        else
            throw `==> User --script to give local path or --repo to give git repository with baker.yml`
    }
}

main();

async function cloneRepo(repoURL){
    let name = path.basename(repoURL);
    name = name.slice(-4) === '.git' ? name.slice(0,-4): name; // Removing .git from the end
    let dir = path.resolve(process.cwd());

    child_process.execSync(`git clone ${repoURL}`, { stdio: 'inherit' });
    return `${path.join(dir, name)}`;
}

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
 * get vagrant id of VMs by name
 */
async function getVagrantIDByName(name) {
    return new Promise((resolve, reject) => {
        vagrant.globalStatus(function(err, out) {
            out.forEach(vm => {
                if (new RegExp(name.toLowerCase()).test(vm.cwd.toLowerCase())) {
                    resolve(vm.id);
                }
            });
            resolve(undefined);
        });
    });
}

/**
 * It will ssh to the vagrant box
 * @param {String} name
 */
async function bakerSSH(name){
    let id = await getVagrantIDByName(name);
    if(id != undefined)
        child_process.execSync(`vagrant ssh ${id}`, { stdio: 'inherit' })
    else
        throw `==> No VM found with this name!`
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
    let doc = yaml.safeLoad(fs.readFileSync(path.join(bakerScriptPath, 'baker.yml'), 'utf8'));

    // if(await getVagrantIDByName() == undefined)
    //     // TODO
    if ((await getState(await getVagrantIDByName('ansible-srv'))) != 'running') {
        console.log(chalk.green('==> Starting ansible server...'));
        return new Promise((resolve, reject) => {
            machine.up(async function(err, out) {
                let ansibleSSHConfig = await getSSHConfig(machine);

                // console.log( out );
                console.log(
                    err || chalk.green('==> Ansible server is now ready!')
                );

                // Copying ansible script to ansible vm
                if(bakerScriptPath != undefined){
                    await copyFromHostToVM(
                        path.resolve(bakerScriptPath, doc.bake.ansible.source),
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
        let ansibleSSHConfig = await getSSHConfig(machine);

        if(bakerScriptPath != undefined){
            await copyFromHostToVM(
                path.resolve(bakerScriptPath, doc.bake.ansible.source),
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
    if ((await getVagrantIDByName('ansible-srv')) != undefined) {
        console.log(chalk.green('==> Ansible server already provisioned...'));
        return;
    } else {
        let machine = vagrant.create({ cwd: ansible });
        let template = fs.readFileSync(path.join(__dirname, './config/AnsibleVM.mustache'), 'utf8');
        let vagrantfile = mustache.render(template, require('./config/AnsibleVM'));
        fs.writeFileSync(path.join(ansible, 'Vagrantfile'), vagrantfile)

        fs.copySync(
            path.resolve(__dirname, './config/provision.shell.sh'),
            path.resolve(ansible, 'provision.shell.sh')
        );

        console.log(chalk.green('==> Creating ansible server...'));

        machine.up(function(err, out) {
            // console.log( out );
            if (err) throw `==> Couldn't start ansible server!!: ${err}`;
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
    destroyVM(await getVagrantIDByName('ansible-srv'));
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
                throw `==> Couldn't get private ssh key of new VM: ${err}`; // err
            }
        });
    });
}

async function copyFromHostToVM(src, dest, destSSHConfig, chmod_=true) {
    return new Promise((resolve, reject) =>
    {
        scp2.scp(
            src,
            {
                host: '127.0.0.1',
                port: destSSHConfig.port,
                username: destSSHConfig.user,
                privateKey: fs.readFileSync(destSSHConfig.private_key, 'utf8'),
                path: dest
            },
            async function(err) {
                if (err)
                {
                    console.log(chalk.bold.red(`==> Failed to configure ssh keys: ${err}`));
                    reject();
                }
                else
                {
                    if(chmod_)
                    {
                        await chmod(dest, destSSHConfig)
                    }
                    resolve();
                }
            }
        );
    });
}

async function sshExec(cmd, sshConfig)
{
    return new Promise((resolve, reject) => {
        var c = new Client();
        c
            .on('ready', function() {
                c.exec(cmd, function(err, stream) {
                    if (err) throw err;
                    stream
                        .on('close', function(code, signal) {
                            c.end();
                            resolve();
                        })
                        .on('data', function(data) {
                            console.log('STDOUT: ' + data);
                        })
                        .stderr.on('data', function(data) {
                            console.log('STDERR: ' + data);
                            reject();
                        });
                });
            })
            .connect({
                host: '127.0.0.1',
                port: sshConfig.port,
                username: sshConfig.user,
                privateKey: fs.readFileSync(sshConfig.private_key)
            });
    });
}


/**
 * chmod 600 the key files on ansible server,
 * add the key to agent,
 * and add the host url to /etc/hosts
 *
 * @param {String} key path to the key on server
 * @param {Object} sshConfig
 */
async function chmod(key, sshConfig) {
    // && eval "$(ssh-agent -s)" && ssh-add ${key}
    return sshExec(`chmod 600 ${key}`, sshConfig);
}

/**
 * Adds the host url to /etc/hosts
 *
 * @param {String} ip
 * @param {String} name
 * @param {Object} sshConfig
 */
async function addToAnsibleHosts(ip, name, sshConfig){
    return sshExec(`echo "[${name}]\n${ip}" > /home/vagrant/baker/${name}/baker_inventory && ansible all -i "localhost," -m lineinfile -a "dest=/etc/hosts line='${ip} ${name}' state=present" -c local --become`, sshConfig);
}

async function runAnsibleVault(doc, pass, vaultFile, dest, sshConfig)
{
    let fn = async () => 
    {
        await sshExec(`cd /home/vagrant/baker/${doc.name} && echo "${pass}" > vault-pwd &&  ansible-vault view ${vaultFile} --vault-password-file=vault-pwd > checkout.key`, sshConfig);
        await sshExec(`cd /home/vagrant/baker/${doc.name} && ansible all -i baker_inventory -m copy -a "src=checkout.key dest=${dest} mode=0600"`, sshConfig)
        await sshExec(`cd /home/vagrant/baker/${doc.name} && rm vault-pwd && rm checkout.key`, sshConfig)

    };
    return fn();
}


// TODO: Need to be cleaning cmd so they don't do things like
// ; sudo rm -rf / on our server...
async function runAnsiblePlaybook(doc, cmd, sshConfig)
{
    let dir = path.join(boxes, doc.name);
    let vm = vagrant.create({ cwd: dir });
    let vmSSHConfigUser = await getSSHConfig(vm);

    return sshExec(`export ANSIBLE_HOST_KEY_CHECKING=false && cd /home/vagrant/baker/${doc.name} && ansible-playbook -i baker_inventory ${cmd} --private-key id_rsa -u ${vmSSHConfigUser.user}`, sshConfig);
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

async function initVagrantFile(vagrantFilePath, doc, template, scriptPath) {
    const vagrant = doc.vagrant;
    await traverse(vagrant);
    doc.vagrant.synced_folders = [...doc.vagrant.synced_folders, ...[{folder : {src: slash(scriptPath), dest: `/${path.basename(scriptPath)}`}}]];
    const output = mustache.render(template, doc);

    fs.writeFileSync(vagrantFilePath, output);
}

function verbose(details) {
    if (argv.verbose || argv.v) {
        console.log(details);
    }
}

async function bake(ansibleSSHConfig, ansibleVM, scriptPath) {
    // TODO: Use version fetched from github.
    let doc = yaml.safeLoad(fs.readFileSync(path.join(scriptPath, 'baker.yml'), 'utf8'));

    let dir = path.join(boxes, doc.name);
    let template = fs.readFileSync(path.join(__dirname, './config/BaseVM.mustache')).toString();

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    let machine = vagrant.create({ cwd: dir });

    await initVagrantFile(path.join(dir, 'Vagrantfile'), doc, template, scriptPath);
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
        if( doc.bake.vault && doc.bake.vault.checkout && doc.bake.vault.checkout.key)
        {
            console.log(chalk.green('==> Checking out keys from vault'));
            let vaultFile = `/home/vagrant/baker/${doc.name}/${doc.bake.vault.checkout.key}`;
            await copyFromHostToVM(
                path.resolve( scriptPath, doc.bake.vault.source ),
                vaultFile,
                ansibleSSHConfig
            );
            // prompt vault pass
            let pass = await promptValue(`vault pass for ${doc.bake.vault.source}`);
            // ansible-vault to checkout key and copy to dest.
            await runAnsibleVault(doc, pass, vaultFile, doc.bake.vault.dest, ansibleSSHConfig)
        }
    });

    machine.on('up-progress', function(data) {
        //console.log(machine, progress, rate, remaining);
        verbose(data);
    });
}
