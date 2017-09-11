'use strict';

module.exports = function(dep) {
    let result = {};

    result.init = function(){
        const { fs, path, configPath } = dep;

        let bakerYML = fs.readFileSync(path.join(configPath, './bakerTemplate.yml'), 'utf8');
        let dir = path.resolve(process.cwd());
        fs.writeFileSync('baker.yml', bakerYML, {encoding:'utf8'});
    }

    /**
     * get State of a vagrant vm by id.
     * @param {String} id
     */
    result.getState = async function(id) {
        const { vagrant, chalk, Promise } = dep;

        return new Promise((resolve, reject) => {
            vagrant.globalStatus(function(err, out) {
                if (err) chalk.red(err);
                resolve(out.filter(vm => vm.id == id).state);
            });
        });
    };

    /**
     * get vagrant id of VMs by name
     */
    result.getVagrantIDByName = async function(name) {
        const { vagrant, Promise } = dep;

        return new Promise((resolve, reject) => {
            vagrant.globalStatus(function(err, out) {
                out.forEach(vm => {
                    if (
                        new RegExp(name.toLowerCase()).test(
                            vm.cwd.toLowerCase()
                        )
                    ) {
                        resolve(vm.id);
                    }
                });
                resolve(undefined);
            });
        });
    };

    /**
     * It will ssh to the vagrant box
     * @param {String} name
     */
    result.bakerSSH = async function(name) {
        const { print, baker, child_process } = dep;

        let id = await baker.getVagrantIDByName(name);
        if (id != undefined)
            child_process.execSync(`vagrant ssh ${id}`, { stdio: 'inherit' });
        else {
            print.error(`No VM found with this name!`);
            process.exit(1);
        }
    };


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
    result.prepareAnsibleServer = async function(bakerScriptPath) {
        const { vagrant, fs, yaml, baker, print, ssh, ansible, path, Promise } = dep;

        let machine = vagrant.create({ cwd: ansible });
        let doc = yaml.safeLoad(fs.readFileSync(path.join(bakerScriptPath, 'baker.yml'), 'utf8'));

        let bakerVMID = await baker.getVagrantIDByName('ansible-srv');

        if(bakerVMID){
            let state = await baker.getState(bakerVMID);
            if (state == 'running') {
                print.success('Baker server is now ready and running.');
                let ansibleSSHConfig = await baker.getSSHConfig(machine);

                await ssh.copyFilesForAnsibleServer(bakerScriptPath, doc, ansibleSSHConfig);

                return machine;
            }

            // state can be aborted, suspended, or not provisioned.
            else {
                print.success('Starting Baker server.');
                return new Promise((resolve, reject) => {
                    machine.up(async function(err, out) {
                        let ansibleSSHConfig = await baker.getSSHConfig(machine);

                        if(err)
                            print.error(err);
                        else
                            print.success('Baker server is now ready and running.');

                        await ssh.copyFilesForAnsibleServer(bakerScriptPath, doc, ansibleSSHConfig);

                        resolve(machine);
                    });

                    machine.on('up-progress', function(data) {
                        print.info(data);
                    });
                });
            }
        }

        else {
            print.error('Baker server is not installed.');
            print.error('To install Baker server run: ', 1);
            print.error('$ baker setup', 1);
        }
    }

    /**
     * Private function
     * Checks if a VM extery with given name exists
     * @param {String} VMName
     */
    async function VMExists(VMName){
        const { vagrant, print, Promise } = dep;

        return new Promise((resolve, reject)=>{
            vagrant.globalStatus(function(err, out) {
                if (err) print.error(err);
                // Checking if the VM exists
                resolve(out.some(vm => vm.name === VMName));
            });
        })
    }

    /**
     * Private function
     * Returns the path of the VM, undefined if VM doesn't exist
     * @param {String} VMName
     */
    async function getVMPath(VMName){
        const { vagrant, print, Promise } = dep;

        return new Promise((resolve, reject)=>{
            vagrant.globalStatus(function(err, out) {
                if (err) print.error(err);

                let VM = out.find(vm => vm.name === VMName);

                if(VM)
                    resolve(VM.cwd);
                else
                    resolve(undefined);
            });
        })
    }

    /**
     * Destroy VM
     * @param {String} VMName
     */
    result.destroyVM = async function(VMName) {
        const { child_process, print, baker } = dep;

        let id = await baker.getVagrantIDByName(VMName);

        child_process.execSync(`vagrant destroy ${id} -f`); // { stdio: (argv.verbose? 'inherit' : 'ignore') }
        print.success(`Destroyed VM: ${id}`);
        return;
    }

    /**
     * Prune
     */
    result.prune = async function() {
        const { child_process, print, baker } = dep;

        child_process.execSync('vagrant global-status --prune', {
            stdio: 'inherit'
        });

        print.info('Removed invalid VM enteries.')

        // Show status after prune completed
        await baker.status();
        return;
    }

    /**
     * Shut down VM
     * @param {String} id
     */
    result.haltVM = async function(VMName, force=false) {
        const { child_process, print, baker } = dep;

        let id = await baker.getVagrantIDByName(VMName);
        child_process.execSync(`vagrant halt ${id} ${force ? '-f' : '' }`); // { stdio: (argv.verbose? 'inherit' : 'ignore') }
        print.success(`Stopped VM: ${id}`);
        return;
    }

    /**
     * Start VM
     * @param {String} name
     */
    result.upVM = async function(VMName) {
        const { vagrant, print } = dep;

        let VMPath = await getVMPath(VMName);

        if(VMPath){
            let machine = vagrant.create({ cwd: VMPath });
            machine.up(async function(err, out) {
                if (err) print.error(err);
                else print.success(`Started VM: ${VMName}`);
                return;
            });
        }
        else {
            print.error(`cannot find machine '${VMName}'.`);
            print.error(`Please check status by running: $ baker status`, 1);
            return;
        }
    };

    /**
     * Creates ansible server, if already doesn't exist
     */
    result.installAnsibleServer = async function() {
        const { baker, print, fs, mustache, path, configPath, vagrant, ansible } = dep;

        if ((await baker.getVagrantIDByName('ansible-srv')) != undefined) {
            print.success('Baker server is already provisioned.');

            // Starting Baker VM, if not running
            if (await baker.getState(await baker.getVagrantIDByName('ansible-srv')) != 'running'){
                let machine = vagrant.create({ cwd: ansible });
                machine.up(function(err, out) {
                    if (err)
                        print.error(`Couldn't start Baker server!: ${err}`, 1);
                    else
                        print.success('Baker server is now ready and running.');

                    return;
                });
            } else {
                print.success('Baker server is already running.')
            }

            return;
        } else {
            let machine = vagrant.create({ cwd: ansible });
            let template = fs.readFileSync(path.join(configPath, './AnsibleVM.mustache'), 'utf8');
            let vagrantfile = mustache.render(template, require('../../config/AnsibleVM'));
            fs.writeFileSync(path.join(ansible, 'Vagrantfile'), vagrantfile)

            fs.copySync(
                path.resolve(configPath, './provision.shell.sh'),
                path.resolve(ansible, 'provision.shell.sh')
            );

            print.bold('Creating Baker server.');

            machine.up(function(err, out) {
                if (err)
                    print.error(`Couldn't start Baker server!: ${err}`, 1);
                else
                    print.success('Baker server is now ready and running.');

                return;
            });

            machine.on('up-progress', function(data) {
                print.info(data);
            });
        }
    }

    /**
     * Re-installs ansible server.
     * @returns Promise
     */
    result.reinstallAnsibleServer = async function() {
        const { baker } = dep;

        baker.destroyVM(await baker.getVagrantIDByName('ansible-srv'));
        await baker.installAnsibleServer();
    }

    /**
     * Get ssh configurations
     * @param {Obj} machine
     */
    result.getSSHConfig = async function(machine) {
        const { print, Promise } = dep;

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

    /**
     * Adds the host url to /etc/hosts
     *
     * @param {String} ip
     * @param {String} name
     * @param {Object} sshConfig
     */
    result.addToAnsibleHosts = async function(ip, name, sshConfig){
        const { ssh } = dep;

        return ssh.sshExec(`echo "[${name}]\n${ip}" > /home/vagrant/baker/${name}/baker_inventory && ansible all -i "localhost," -m lineinfile -a "dest=/etc/hosts line='${ip} ${name}' state=present" -c local --become`, sshConfig);
    }

    result.setKnownHosts = async function(ip, sshConfig) {
        const { ssh } = dep;

        return ssh.sshExec(`cd /home/vagrant/baker/ && ansible-playbook -i "localhost," registerhost.yml -e "ip=${ip}" -c local`, sshConfig);
    }

    result.runAnsibleVault = async function(doc, pass, dest, sshConfig, vmSSHConfigUser) {
        const { ssh, Promise } = dep;

        return new Promise( async (resolve, reject) => {
            let key = doc.bake.vault.checkout.key;
            await ssh.sshExec(`cd /home/vagrant/baker/${doc.name} && echo "${pass}" > vault-pwd`, sshConfig);
            await ssh.sshExec(`cd /home/vagrant/baker/${doc.name} && ansible-playbook -e "vault=${doc.name}/baker-vault.yml key=${key} dest=${dest}" -i baker_inventory --vault-password-file=vault-pwd --private-key id_rsa -u ${vmSSHConfigUser.user} ../CheckoutFromVault.yml`, sshConfig)
            //await sshExec(`cd /home/vagrant/baker/${doc.name} && echo "${pass}" > vault-pwd &&  ansible-vault view baker-vault.yml --vault-password-file=vault-pwd > checkout.key`, sshConfig);
            //await sshExec(`cd /home/vagrant/baker/${doc.name} && ansible all -i baker_inventory --private-key id_rsa -u ${vmSSHConfigUser.user} -m copy -a "src=checkout.key dest=${dest} mode=0600"`, sshConfig)
            await ssh.sshExec(`cd /home/vagrant/baker/${doc.name} && rm vault-pwd`, sshConfig)
            resolve();
        });
    }

    // TODO: Need to be cleaning cmd so they don't do things like
    // ; sudo rm -rf / on our server...
    result.runAnsiblePlaybook = async function(doc, cmd, sshConfig) {
        const { path, vagrant, baker, ssh, boxes } = dep;

        let dir = path.join(boxes, doc.name);
        let vm = vagrant.create({ cwd: dir });
        let vmSSHConfigUser = await baker.getSSHConfig(vm);

        return ssh.sshExec(`export ANSIBLE_HOST_KEY_CHECKING=false && cd /home/vagrant/baker/${doc.name} && ansible-playbook -i baker_inventory ${cmd} --private-key id_rsa -u ${vmSSHConfigUser.user}`, sshConfig);
    }

    result.promptValue = async function(propertyName, description,hidden=false) {
        const { prompt, Promise } = dep;

        return new Promise((resolve, reject) => {
            prompt.start();
            prompt.get([{ name: propertyName, description: description, hidden:hidden }], function(
                err,
                result
            ) {
                if (err) {
                    print.error(err);
                }
                //prompt.stop();
                resolve(result[propertyName]);
            });
        });
    }

    /**
     * Private function:
     * Traverse yaml and do prompts
     */
    async function traverse(o) {
        const { baker } = dep;
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
                    const input = await baker.promptValue(parentKey, obj[key]);
                    // Replace "prompt" with an value provided by user.
                    parent[parentKey] = input;
                }
            }
        }
        return o;
    }

    result.initVagrantFile = async function(vagrantFilePath, doc, template, scriptPath) {
        const { mustache, fs, path, slash } = dep;

        const vagrant = doc.vagrant;
        await traverse(vagrant);
        let syncFolders = doc.vagrant.synced_folders || [];
        doc.vagrant.synced_folders = [...syncFolders, ...[{folder : {src: slash(scriptPath), dest: `/${path.basename(scriptPath)}`}}]];
        const output = mustache.render(template, doc);

        fs.writeFileSync(vagrantFilePath, output);
    }

    result.status = async function() {
        const { chalk, vagrant, print } = dep;

        vagrant.globalStatus(function(err, out) {
            if (err) print.error(err);

            // Only showing baker VMs
            out = out.filter(vm => vm.cwd.includes('.baker/'));

            console.table(chalk.bold('Baker status'), out);
            return;
        });
    }

    result.bake = async function(ansibleSSHConfig, ansibleVM, scriptPath) {
        var { yaml, path, fs, vagrant, baker, print, ssh, boxes, configPath } = dep;

        let doc = yaml.safeLoad(fs.readFileSync(path.join(scriptPath, 'baker.yml'), 'utf8'));

        let dir = path.join(boxes, doc.name);
        let template = fs.readFileSync(path.join(configPath, './BaseVM.mustache')).toString();

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }

        let machine = vagrant.create({ cwd: dir });

        await baker.initVagrantFile(path.join(dir, 'Vagrantfile'), doc, template, scriptPath);
        print.bold('Baking VM...');

        machine.up(async function(err, out) {
            if(err)
                print.error(err, 1);
            else
                print.success('New VM is ready and running.', 1);

            let sshConfig = await baker.getSSHConfig(machine);
            let ip = doc.vagrant.network.find((item)=>item.private_network!=undefined).private_network.ip;
            await ssh.copyFromHostToVM(
                sshConfig.private_key,
                `/home/vagrant/baker/${doc.name}/id_rsa`,
                ansibleSSHConfig
            );

            await baker.addToAnsibleHosts(ip, doc.name, ansibleSSHConfig)
            await baker.setKnownHosts(ip, ansibleSSHConfig);

            if(doc.bake && doc.bake.ansible && doc.bake.ansible.playbooks){
                print.info('Running your Ansible playbooks.', 1);
                for( var i = 0; i < doc.bake.ansible.playbooks.length; i++ ) {
                    var cmd = doc.bake.ansible.playbooks[i];
                    await baker.runAnsiblePlaybook(
                        doc, cmd, ansibleSSHConfig
                    )
                }
            }

            if( doc.bake && doc.bake.vault && doc.bake.vault.checkout && doc.bake.vault.checkout.key) {
                print.info('Checking out keys from vault.', 1);
                let vaultFile = `/home/vagrant/baker/${doc.name}/baker-vault.yml`;
                await ssh.copyFromHostToVM(
                    path.resolve( scriptPath, doc.bake.vault.source ),
                    vaultFile,
                    ansibleSSHConfig
                );
                // prompt vault pass
                let pass = await baker.promptValue('pass', `vault pass for ${doc.bake.vault.source}`, hidden=true);
                // ansible-vault to checkout key and copy to dest.
                await baker.runAnsibleVault(doc, pass, doc.bake.vault.checkout.dest, ansibleSSHConfig, sshConfig)
            }
        });

        machine.on('up-progress', function(data) {
            //console.log(machine, progress, rate, remaining);
            print.info(data);
        });
    }

    return result;
};
