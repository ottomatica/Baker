const Promise       =      require('bluebird');
const child_process =      Promise.promisifyAll(require('child_process'));
const conf          =      require('../configstore');
const fs            =      require('fs-extra');
const mustache      =      require('mustache');
const path          =      require('path');
const print         =      require('../print');
const Provider      =      require('./provider');
const slash         =      require('slash')
const spinner       =      require('../spinner');
const Ssh           =      require('../ssh');
const Utils         =      require('../utils/utils');
const vagrant       =      Promise.promisifyAll(require('node-vagrant'));

const vbox          =      require('node-virtualbox');
const VBoxProvider  =      require('node-virtualbox/lib/VBoxProvider');
const private_key   =      require.resolve('node-virtualbox/config/resources/insecure_private_key');

const yaml          =      require('js-yaml');
const spinnerDot    =      conf.get('spinnerDot');

const _             =      require('underscore');

const {ansible, boxes, bakeletsPath, remotesPath, configPath} = require('../../../global-vars');

class VirtualBoxProvider extends Provider {
    constructor() {
        super();

        this.driver = new VBoxProvider();
    }

    async initVagrantFile(vagrantFilePath, doc, template, scriptPath) {
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
        await fs.writeFile(vagrantFilePath, output);
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
            Utils.removeFromIndex(VMName);
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

        // Use VirtualBox driver
        let vmInfo = await this.driver.info(machine);
        let port = null;
        if( vmInfo.hasOwnProperty('Forwarding(0)') )
        {
          port = parseInt( vmInfo['Forwarding(0)'].split(',')[3]);
        }
        return {user: 'vagrant', port: port, host: machine, hostname: '127.0.0.1', private_key: private_key};
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
            let info = await this.getSSHConfig(name);
            // hack
            let key = path.join(require('os').tmpdir(), `${name}-key`);
            fs.copyFileSync(info.private_key, key );
            fs.chmod(key, "600");

            child_process.execSync(`ssh -i ${key} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes -p ${info.port} ${info.user}@127.0.0.1`, {stdio: ['inherit', 'inherit', 'ignore']});
        } catch(err) {
            throw err;
        }
    }

    // also in servers.js
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

    async bake(scriptPath, ansibleSSHConfig, verbose) {
        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));

        let dir = path.join(boxes, doc.name);

        try {
            await fs.ensureDir(dir);
        } catch (err) {
            throw `Creating directory failed: ${dir}`;
        }

        let vms = await this.driver.list();
        let vm = _.findWhere( vms, {name: doc.name} );
        if( !vm )
        {
            // Create VM
            console.log( "Creating vm. ")
            await vbox({provision: true, ip: doc.vm.ip, vmname: doc.name, syncs: [], verbose: true});
        }
        let vmInfo = await this.driver.info(doc.name);
        console.log( `VM is currently in state ${vmInfo.VMState}`)
        if( vmInfo.VMState != '"running"' )
        {
            await vbox({start: true, vmname: doc.name, verbose: true});

            // todo: basic ssh check to make sure ready.
        }

        let sshConfig = await this.getSSHConfig(doc.name);

        //console.log( ansibleSSHConfig, sshConfig);

        let ip = doc.vm.ip;
        await Ssh.copyFromHostToVM(
            sshConfig.private_key,
            `/home/vagrant/baker/${doc.name}/${ip}_rsa`,
            ansibleSSHConfig
        );

        //TODO: temperary for bakerformac PoC
        await Ssh.copyFromHostToVM(
            path.join(configPath, 'common', 'registerhost.yml'),
            `/home/vagrant/baker/registerhost.yml`,
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

        // Hack make sure has python2
        try
        {
            await Ssh.sshExec(`/usr/bin/python --version 2> /dev/null || (sudo apt-get update && sudo apt-get -y install python-minimal)`, sshConfig, true);
        }
        catch(e)
        {

        }
        // Installing stuff.
        let resolveB = require('../../bakelets/resolve');
        await resolveB.resolveBakelet(bakeletsPath, remotesPath, doc, scriptPath, verbose)

    }

    static async retrieveSSHConfigByName(name) {
        let dir = path.join(boxes, name);
        let vm = vagrant.create({ cwd: dir });
        let vmSSHConfigUser = await this.getSSHConfig(vm);
        return vmSSHConfigUser;
    }


    static async package(VMName, verbose) {
        let dir = path.join(boxes, VMName);
        await child_process.execAsync(`cd ${dir} && vagrant package --output ${path.join(process.cwd(), VMName + '.box')}`, {
            stdio: ['inherit', 'inherit', 'ignore']
        });
    }

    static async import(box, name, verbose) {
        let boxName = name ? name : path.basename(box).split('.')[0];
        await vagrant.boxAddAsync(path.join(process.cwd(), box), ['--name', boxName + '.baker'])
        // await child_process.execAsync(`vagrant box add ${boxName}.baker ${path.join(process.cwd(), box)}`, {stdio: ['inherit', 'inherit', 'ignore']});
    }

    async boxes() {
        try {
            let boxes = await vagrant.boxListAsync([]);
            delete boxes.version;
            return boxes;
        } catch (err) {
            throw err
        }
    }

    async bakerBoxes(verbose=true) {
        try {
            let boxes = await this.boxes();
            let bakerBoxes = boxes.filter(box => box.name.match(/.baker$/));
            // Hide .baker from the end before printing
            bakerBoxes.forEach(box => {
                box.name = box.name.split('.')[0];
            })

            if(verbose){
                if(bakerBoxes == [])
                    print.info(`\nYou currently don't have any boxes.`)
                else
                    console.table('\nBaker boxes: ', bakerBoxes);
            }
            return bakerBoxes;
        } catch (err) {
            throw err
        }
    }

    async bakeBox(ansibleSSHConfig, ansibleVM, scriptPath, verbose) {
        try {
            let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));

            let dir = path.join(boxes, doc.name);
            try {
                await fs.ensureDir(dir);
            } catch (err) {
                throw `Creating directory failed: ${dir}`;
            }

            let template = await fs.readFile(path.join(configPath, './BaseVM.mustache'), 'utf8');

            // if box is specified in baker.yml and this box exists, then use it => otherwise bake it
            if(doc.vagrant.box && (await this.bakerBoxes(false)).map(e=>e.name).includes(`${doc.vagrant.box}`)){

                await this.provider.initVagrantFile(path.join(dir, 'Vagrantfile'), doc, template, scriptPath);

                let machine = vagrant.create({ cwd: dir });
                machine.on('up-progress', function(data) {
                    if( verbose ) print.info(data);
                });
                await spinner.spinPromise(machine.upAsync(), `Starting VM`, spinnerDot);
            }
            else {
                await this.bakeBox(sshConfig, ansibleVM, bakePath, verbose);
            }

        } catch (err) {
            throw err;
        }

        return;
    }
}

module.exports = VirtualBoxProvider;
