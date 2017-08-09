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
const validator = require('validator');
const print = require(path.resolve('./print'));

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

    if (argv.setup) await installAnsibleServer();
    else if (argv.reinstall) await reinstallAnsibleServer();
    else if(argv.ssh){
        bakerSSH(argv.ssh);
    }
    else if(argv.init){
        init();
    }
    else if(argv.prune){
        // TODO: After added --status command, update this to show that after completed.
        child_process.execSync('vagrant global-status --prune', { stdio: 'inherit' });
    }
    else if(argv.destroy){
        destroyVM(await getVagrantIDByName(argv.destroy));
    }
    else if(argv.test){
        validateBakerScript(path.resolve(argv.test));
    }
    else {
        let ansibleVM;
        if(argv.local){
            validateBakerScript(path.resolve(argv.local));
            ansibleVM = await prepareAnsibleServer(path.resolve(argv.local));
            let sshConfig = await getSSHConfig(ansibleVM);
            bake(sshConfig, ansibleVM, path.resolve(argv.local));
        }
        else if (argv.repo){
            let localRepoPath = await cloneRepo(argv.repo);
            validateBakerScript(path.resolve(localRepoPath));
            ansibleVM = await prepareAnsibleServer(localRepoPath);
            let sshConfig = await getSSHConfig(ansibleVM);
            bake(sshConfig, ansibleVM, localRepoPath);
        }
        else{
            print.error(`User --local to give local path or --repo to give git repository with baker.yml`);
            process.exit(1);
        }
    }
}

main();

function validateBakerScript(bakerScriptPath){
    print.bold('Validating baker.yml');

    let doc;
    try {
        doc = yaml.safeLoad(fs.readFileSync(path.join(bakerScriptPath, 'baker.yml'), 'utf8'));
    } catch (error) {
        print.error(`baker.yml error: Couldn't parse baker.yml`, 1);
    }
    let passed = true;

    if(!doc.name){
        print.error('baker.yml error: You need to provide a name for your VM.', 1);
        passed = false;
    }

    if(!doc.vagrant){
        print.error('baker.yml error: You need to specify your VM configurations.', 1);
        passed = false;
    }

    if(!doc.vagrant.box){
        print.error(`baker.yml error: You need to specify what vagrant box you want Baker to use for your VM.`, 1);
        print.error(`If you're not sure, we suggest using ubuntu/trusty64`, 2);
        passed = false;
    }

    if(!doc.vagrant.memory){
        print.error('baker.yml error: You need to specify how much RAM you want Baker to share with your VM.', 1);
        passed = false;
    } else if(doc.vagrant.memory > 2048){
        print.warning(`baker.yml warning: Sharing big amounts of RAM with your VM can possibly slow down your computer.`, 1)
    }

    if(!doc.vagrant.network || !doc.vagrant.network.some(network => network.private_network != undefined)){
        print.error('baker.yml error: You need to create a private network for Baker to use for communicating with your VM.', 1);
        passed = false;
    } else if(!doc.vagrant.network.some(network => validator.isIP(network.private_network.ip))){
        print.error(`baker.yml error: Private network doesn't have a valid IP address`, 1);
        passed = false;
    }

    if(!passed){
        print.error('Use `baker --init` to create a baker.yml which you can then update for your project.', 2);
        process.exit(1);
    } else {
        print.success('baker.yml passed validation', 1);
    }
}

function init(){
    let bakerYML = fs.readFileSync(path.join(__dirname, './config/bakerTemplate.yml'), 'utf8');
    let dir = path.resolve(process.cwd());
    fs.writeFileSync('baker.yml', bakerYML, {encoding:'utf8'});
}

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

    let state = await getState(await getVagrantIDByName('ansible-srv'));
    if (state == 'running')
    {
        print.success('Baker server is now ready and running.');
        let ansibleSSHConfig = await getSSHConfig(machine);

        await copyFilesForAnsibleServer(bakerScriptPath, doc, ansibleSSHConfig);

        return machine;
    }
    // state can be aborted, suspended, or not provisioned.
    else
    {
        print.success('Starting Baker server.');
        return new Promise((resolve, reject) => {
            machine.up(async function(err, out) {
                let ansibleSSHConfig = await getSSHConfig(machine);

                if(err)
                    print.error(err);
                else
                    print.success('Baker server is now ready and running.');

                await copyFilesForAnsibleServer(bakerScriptPath, doc, ansibleSSHConfig);

                resolve(machine);
            });

            machine.on('up-progress', function(data) {
                verbose(data);
            });
        });
    }
}

async function copyFilesForAnsibleServer(bakerScriptPath, doc, ansibleSSHConfig)
{
        return new Promise( async (resolve, reject) =>
        {
            if(doc.bake && doc.bake.ansible && doc.bake.ansible.source){
                // Copying ansible script to ansible vm
                if(bakerScriptPath != undefined){
                    await copyFromHostToVM(
                        path.resolve(bakerScriptPath, doc.bake.ansible.source),
                        `/home/vagrant/baker/${doc.name}`,
                        ansibleSSHConfig,
                        false
                    );
                }
            }

            // Copy common ansible scripts files
            await copyFromHostToVM(
                path.resolve(__dirname, './config/common/registerhost.yml'),
                `/home/vagrant/baker/registerhost.yml`,
                ansibleSSHConfig,
                false
            );

            await copyFromHostToVM(
                path.resolve(__dirname, './config/common/CheckoutFromVault.yml'),
                `/home/vagrant/baker/CheckoutFromVault.yml`,
                ansibleSSHConfig,
                false
            );

            resolve();
        });
}

/**
 * Destroy a vagrant vm sync
 * @param {String} id
 */
function destroyVM(id) {
    child_process.execSync(`vagrant destroy ${id} -f`, { stdio: (argv.verbose? 'inherit' : 'ignore') });
    print.success(`Destroyed VM: ${id}`);
}

/**
 * Creates ansible server, if already doesn't exist
 */
async function installAnsibleServer() {
    if ((await getVagrantIDByName('ansible-srv')) != undefined) {
        print.success('Baker server already provisioned.');
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

        print.info('Creating Baker server.');

        machine.up(function(err, out) {
            if (err)
                print.error(`Couldn't start Baker server!: ${err}`, 1);
            else
                print.success('Baker server is now ready and running.');

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
                print.error(`Couldn't get private ssh key of new VM: ${err}`);
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
                    print.error(`Failed to configure ssh keys: ${err}`);
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
async function setKnownHosts(ip, sshConfig) {
    return sshExec(`cd /home/vagrant/baker/ && ansible-playbook -i "localhost," registerhost.yml -e "ip=${ip}" -c local`, sshConfig);
}

async function runAnsibleVault(doc, pass, dest, sshConfig, vmSSHConfigUser)
{
    return new Promise( async (resolve, reject) =>
    {
        let key = doc.bake.vault.checkout.key;
        await sshExec(`cd /home/vagrant/baker/${doc.name} && echo "${pass}" > vault-pwd`, sshConfig);
        await sshExec(`cd /home/vagrant/baker/${doc.name} && ansible-playbook -e "vault=${doc.name}/baker-vault.yml key=${key} dest=${dest}" -i baker_inventory --vault-password-file=vault-pwd --private-key id_rsa -u ${vmSSHConfigUser.user} ../CheckoutFromVault.yml`, sshConfig)
        //await sshExec(`cd /home/vagrant/baker/${doc.name} && echo "${pass}" > vault-pwd &&  ansible-vault view baker-vault.yml --vault-password-file=vault-pwd > checkout.key`, sshConfig);
        //await sshExec(`cd /home/vagrant/baker/${doc.name} && ansible all -i baker_inventory --private-key id_rsa -u ${vmSSHConfigUser.user} -m copy -a "src=checkout.key dest=${dest} mode=0600"`, sshConfig)
        await sshExec(`cd /home/vagrant/baker/${doc.name} && rm vault-pwd`, sshConfig)
        resolve();
    });
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

async function promptValue(propertyName, description,hidden=false) {
    return new Promise((resolve, reject) => {
        prompt.start();
        prompt.get([{ name: propertyName, description: description, hidden:hidden }], function(
            err,
            result
        ) {
            if (err) {
                pritn.error(err);
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
    let syncFolders = doc.vagrant.synced_folders || [];
    doc.vagrant.synced_folders = [...syncFolders, ...[{folder : {src: slash(scriptPath), dest: `/${path.basename(scriptPath)}`}}]];
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
    print.bold('Baking VM...');

    machine.up(async function(err, out) {
        if(err)
            print.error(err, 1);
        else
            print.success('New VM is ready and running.', 1);

        let sshConfig = await getSSHConfig(machine);
        let ip = doc.vagrant.network.find((item)=>item.private_network!=undefined).private_network.ip;
        await copyFromHostToVM(
            sshConfig.private_key,
            `/home/vagrant/baker/${doc.name}/id_rsa`,
            ansibleSSHConfig
        );

        await addToAnsibleHosts(ip, doc.name, ansibleSSHConfig)
        await setKnownHosts(ip, ansibleSSHConfig);

        if(doc.bake && doc.bake.ansible && doc.bake.playbooks){
            print.info('Running your Ansible playbooks.', 1);
            for( var i = 0; i < doc.bake.ansible.playbooks.length; i++ )
            {
                var cmd = doc.bake.ansible.playbooks[i];
                await runAnsiblePlaybook(
                    doc, cmd, ansibleSSHConfig
                )
            }
        }

        if( doc.bake && doc.bake.vault && doc.bake.vault.checkout && doc.bake.vault.checkout.key)
        {
            print.info('Checking out keys from vault.', 1);
            let vaultFile = `/home/vagrant/baker/${doc.name}/baker-vault.yml`;
            await copyFromHostToVM(
                path.resolve( scriptPath, doc.bake.vault.source ),
                vaultFile,
                ansibleSSHConfig
            );
            // prompt vault pass
            let pass = await promptValue('pass', `vault pass for ${doc.bake.vault.source}`, hidden=true);
            // ansible-vault to checkout key and copy to dest.
            await runAnsibleVault(doc, pass, doc.bake.vault.checkout.dest, ansibleSSHConfig, sshConfig)
        }
    });

    machine.on('up-progress', function(data) {
        //console.log(machine, progress, rate, remaining);
        verbose(data);
    });
}
