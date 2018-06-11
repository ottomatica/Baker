const Promise       =      require('bluebird');
const child_process =      Promise.promisifyAll(require('child_process'));
const conf          =      require('../configstore');
const fs            =      Promise.promisifyAll(require('fs-extra'));
const mustache      =      require('mustache');
const path          =      require('path');
const print         =      require('../print');
const Provider      =      require('./provider');
const slash         =      require('slash')
const spinner       =      require('../spinner');
const Ssh           =      require('../ssh');
const Utils         =      require('../utils/utils');
const vagrant       =      Promise.promisifyAll(require('node-vagrant'));
const yaml          =      require('js-yaml');

const spinnerDot    =      conf.get('spinnerDot');

const {ansible, boxes, bakeletsPath, remotesPath, configPath} = require('../../../global-vars');

class Vagrant extends Provider {
    constructor() {
        super();
        this.ansibleSevrer = vagrant.create({cwd: ansible});
        // this.VMPath = VMPath;
        // this.machine = vagrant.create({ cwd: VMPath });
    }

    async initVagrantFile (vagrantFilePath, doc, template, scriptPath) {
        if (doc.vm ) {
            doc.vagrant = doc.vm;
            delete doc.vm;
        }
        const vagrant = doc.vagrant;
        await Utils.traverse(vagrant);
        // Defaults
        // vagrant.box = vagrant.box || "ubuntu/xenial64"
        // TODO: Cleanup this mess
        if (vagrant.box && (await this.boxes()).map(e=>e.name).includes(`${vagrant.box}.baker`)){
            vagrant.box = vagrant.box + '.baker';
        }
        else if(vagrant.box && (await this.boxes()).map(e=>e.name).includes(`${vagrant.box}`)){
            vagrant.box = vagrant.box;
        }
        else{
            vagrant.box = "ubuntu/xenial64";
        }
        vagrant.memory = vagrant.memory || "1024"

        // Adaptor pattern: Support baker2 and baker format
        let network = doc.vagrant.network || [];
        if( vagrant.ip )
        {
            network = [...network, ...[{private_network: {ip: vagrant.ip}}]];
        }
        if( vagrant.ports )
        {
            // ports: '8000, 9000,  1000:3000'
            let ports = vagrant.ports.toString().trim().split(/\s*,\s*/g);
            for( var port of ports  )
            {
                let a = port.trim().split(/\s*:\s*/g);
                let guest = a[0];
                let host  = a[1] || a[0]; // if undefined use same as guest port for host port.
                network = [...network, ...[{forwarded_port: {guest: guest, host: host}}]];
            }
        }
        vagrant.network = network;

        let syncFolders = doc.vagrant.synced_folders || [];
        doc.vagrant.synced_folders = [...syncFolders, ...[{folder : {src: slash(scriptPath), dest: `/${path.basename(scriptPath)}`}}]];
        const output = mustache.render(template, doc);
        await fs.writeFileAsync(vagrantFilePath, output);
    }

    /**
     * Prune
     */
    static async prune() {
        try {
            await vagrant.globalStatusAsync('--prune');
            return;
        } catch (err) {
            throw err;
        }
    }

    async list() {
        try {
            let VMs = await vagrant.globalStatusAsync();
            // Only showing baker VMs
            VMs = VMs.filter(VM => VM.cwd.includes('.baker/'));
            console.table('\nBaker status: ', VMs);
        } catch (err) {
            throw err
        }
        return;
    }

    /**
     * Starts a VM by name
     * @param {String} VMName Name of the VM to be started
     * @param {boolean} verbose
     */
    async start(VMName, verbose = false) {
        let machine = await this.getMachine(VMName);
        machine.on('up-progress', function (data) {
            if (verbose) print.info(data);
        });

        try {
            await machine.upAsync();
        } catch (err) {
            throw `Failed to start machine ${VMName}`;
        }
    }

    /**
     * Shut down a VM by name
     * @param {String} VMName Name of the VM to be halted
     * TODO: add force option
     */
    async stop(VMName, force = false) {
        try {
            let machine = await this.getMachine(VMName);
            try {
                await machine.haltAsync();
            } catch (err) {
                throw `Failed to shutdown machine ${VMName}`;
            }
        } catch (err) {
            throw err;
        }
        return;
    }

    /**
     * Destroy VM
     * @param {String} VMName
     */
    async delete(VMName) {
        let machine = await this.getMachine(VMName);

        try {
            await machine.destroyAsync();
        } catch (err) {
            throw `Failed to destroy machine ${VMName}`;
        }
    }

    /**
     * Get ssh configurations
     * @param {Obj} machine
     * @param {Obj} nodeName Optionally give name of machine when multiple machines declared in single Vagrantfile.
     */
    async getSSHConfig(machine, nodeName) {
        try {
            let sshConfig = await machine.sshConfigAsync();
            if(sshConfig && sshConfig.length > 0){

                if( nodeName )
                {
                    for( var i = 0; i < sshConfig.length; i++ )
                    {
                        if( sshConfig[i].host === nodeName )
                           return sshConfig[i];
                    }
                }
                return sshConfig[0];
            } else{
                throw '';
            }
        } catch (err) {
            throw `Couldn't get private ssh key of machine ${err}`;
        }
    }

    /**
     * Private function
     * Returns the path of the VM, undefined if VM doesn't exist
     * @param {String} VMName
     */
    async getVMPath(VMName) {
        let VMs = await vagrant.globalStatusAsync();
        let VM = VMs.find(VM => VM.name === VMName);

        if (VM)
            return VM.cwd;
        else
            throw `Cannot find machine: ${VMName}`;
    }

    async getMachine(VMName) {
        let VMPath = await this.getVMPath(VMName);
        return vagrant.create({ cwd: VMPath });
    }

    /**
     * Returns vagrant id of VMs by name
     * @param {String} VMName
     */
    async getVagrantID(VMName) {
        let VMs = await vagrant.globalStatusAsync();
        let VM = VMs.find(VM => VM.name == VMName);

        if (!VM)
            throw `Cannot find machine: ${VMName}`;
        return VM.id;
    }

    /**
     * Returns State of a VM
     * @param {String} VMName
     */
    static async getState(VMName) {
        try {
            let VMs = await vagrant.globalStatusAsync();
            let VM = VMs.find(VM => VM.name == VMName);
            if(!VM)
                throw  `Cannot find machine: ${VMName}`;
            return VM.state;
        } catch (err) {
            throw err;
        }
    }

    /**
     * It will ssh to the vagrant box
     * @param {String} name
     */
    async ssh(name) {
        try {
            let id = await this.getVagrantID(name);
            try {
                child_process.execSync(`vagrant ssh ${id}`, {stdio: ['inherit', 'inherit', 'ignore']});
            } catch (err) {
                throw `VM must be running to open SSH connection. Run \`baker status\` to check status of your VMs.`
            }
        } catch(err) {
            throw err;
        }
    }

    /**
     * Adds inventory
     *
     * @param {String} ip
     * @param {String} name
     * @param {Object} sshConfig
     */
    async addToAnsibleHosts(ip, name, ansibleSSHConfig, vmSSHConfig) {
        // TODO: Consider also specifying ansible_connection=${} to support containers etc.
        // TODO: Callers of this can be refactored to into two methods, below:
        return Ssh.sshExec(`echo "[${name}]\n${ip}\tansible_ssh_private_key_file=${ip}_rsa\tansible_user=${vmSSHConfig.user}" > /home/vagrant/baker/${name}/baker_inventory && ansible all -i "localhost," -m lineinfile -a "dest=/etc/hosts line='${ip} ${name}' state=present" -c local --become`, ansibleSSHConfig);
    }

    async bake1(ansibleSSHConfig, ansibleVM, scriptPath) {
        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));

        let dir = path.join(boxes, doc.name);
        let template = await fs.readFile(path.join(configPath, './BaseVM.mustache'), 'utf8');

        try {
            await fs.ensureDir(dir);
        } catch (err) {
            throw `Creating directory failed: ${dir}`;
        }

        let machine = vagrant.create({ cwd: dir });


        await this.initVagrantFile(path.join(dir, 'Vagrantfile'), doc, template, scriptPath);

        try {

            await machine.upAsync();

            let sshConfig = await this.getSSHConfig(machine);
            let ip = doc.vagrant.network.find((item)=>item.private_network!=undefined).private_network.ip;
            await Ssh.copyFromHostToVM(
                sshConfig.private_key,
                `/home/vagrant/baker/${doc.name}/${ip}_rsa`,
                ansibleSSHConfig
            );

            await this.addToAnsibleHosts(ip, doc.name, ansibleSSHConfig, sshConfig)
            await this.setKnownHosts(ip, ansibleSSHConfig);

            if(doc.bake && doc.bake.ansible && doc.bake.ansible.playbooks){
                print.info('Running your Ansible playbooks.', 1);

                let vmSSHConfig = await this.getSSHConfig(machine);

                for( var i = 0; i < doc.bake.ansible.playbooks.length; i++ ) {
                    var cmd = doc.bake.ansible.playbooks[i];
                    await this.runAnsiblePlaybook(
                        doc, cmd, ansibleSSHConfig, false, {}
                    )
                }
            }

            if( doc.bake && doc.bake.vault && doc.bake.vault.checkout && doc.bake.vault.checkout.key) {
                print.info('Checking out keys from vault.', 1);
                let vaultFile = `/home/vagrant/baker/${doc.name}/baker-vault.yml`;
                await Ssh.copyFromHostToVM(
                    path.resolve( scriptPath, doc.bake.vault.source ),
                    vaultFile,
                    ansibleSSHConfig
                );
                // prompt vault pass
                let pass = await this.promptValue('pass', `vault pass for ${doc.bake.vault.source}`, hidden=true);
                // ansible-vault to checkout key and copy to dest.
                await this.runAnsibleVault(doc, pass, doc.bake.vault.checkout.dest, ansibleSSHConfig)
            }

        } catch (err) {
            throw err;
        }
    }

    async bake(ansibleSSHConfig, ansibleVM, scriptPath, verbose) {
        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));

        let dir = path.join(boxes, doc.name);
        let template = await fs.readFile(path.join(configPath, './BaseVM.mustache'), 'utf8');

        try {
            await fs.ensureDir(dir);
        } catch (err) {
            throw `Creating directory failed: ${dir}`;
        }

        let machine = vagrant.create({ cwd: dir });

        await this.initVagrantFile(path.join(dir, 'Vagrantfile'), doc, template, scriptPath);

        try {

            machine.on('up-progress', function(data) {
                //console.log(machine, progress, rate, remaining);
                if( verbose ) print.info(data);
            });

            await spinner.spinPromise(machine.upAsync(), `Provisioning VM in VirtualBox`, spinnerDot);

            let sshConfig = await this.getSSHConfig(machine);

            let ip = doc.vagrant.ip;
            await Ssh.copyFromHostToVM(
                sshConfig.private_key,
                `/home/vagrant/baker/${doc.name}/${ip}_rsa`,
                ansibleSSHConfig
            );

            await this.addToAnsibleHosts(ip, doc.name, ansibleSSHConfig, sshConfig)
            await this.setKnownHosts(ip, ansibleSSHConfig);
            await this.mkTemplatesDir(doc, ansibleSSHConfig);

            // prompt for passwords
            if( doc.vars )
            {
                await this.traverse(doc.vars);
            }

            // let vmSSHConfig = await this.getSSHConfig(machine);

            // Installing stuff.
            let resolveB = require('../../bakelets/resolve');
            await resolveB.resolveBakelet(bakeletsPath, remotesPath, doc, scriptPath, verbose)

        } catch (err) {
            console.log(err.stack);
            throw err;
        }
    }

    static async retrieveSSHConfigByName(name) {
        let dir = path.join(boxes, name);
        let vm = vagrant.create({ cwd: dir });
        let vmSSHConfigUser = await this.getSSHConfig(vm);
        return vmSSHConfigUser;
    }

}

module.exports = Vagrant;
