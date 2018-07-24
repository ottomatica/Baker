const Promise       =      require('bluebird');
const child_process =      Promise.promisifyAll(require('child_process'));
const fs            =      require('fs-extra');
const path          =      require('path');
const Provider      =      require('./provider');
const Ssh           =      require('../ssh');
const Servers       =      require('../../modules/servers');
const conf          = require('../../modules/configstore');
const Spinner       = require('../../modules/spinner');
const spinnerDot    = conf.get('spinnerDot');
const Utils         = require('../utils/utils');
const slash         =      require('slash');

const vbox          =      require('node-virtualbox');
const VBoxProvider  =      require('node-virtualbox/lib/VBoxProvider');
const private_key   =      require.resolve('node-virtualbox/config/resources/insecure_private_key');

const yaml          =      require('js-yaml');

const _             =      require('underscore');

const {boxes, bakeletsPath, remotesPath, configPath} = require('../../../global-vars');

class VirtualBoxProvider extends Provider {
    constructor() {
        super();

        this.driver = new VBoxProvider();
    }

    /**
     * Prune
     */
    static async prune() {
    }

    async list() {
        try {
            // let VMs = await vagrant.globalStatusAsync();
            let VMs = await this.driver.list();
            // Only showing baker VMs
            // VMs = VMs.filter(VM => VM.cwd.includes('.baker/'));
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
        await vbox({start: true, vmname: VMName, syncs: [], verbose: verbose});
    }

    /**
     * Shut down a VM by name
     * @param {String} VMName Name of the VM to be halted
     * TODO: add force option
     */
    async stop(VMName, force = false) {
        await vbox({stopCmd: true, vmname: VMName, syncs: [], verbose: true});
    }

    /**
     * Destroy VM
     * @param {String} VMName
     */
    async delete(VMName) {
        await vbox({deleteCmd: true, vmname: VMName, syncs: [], verbose: true});
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
     * Returns State of a VM
     * @param {String} VMName
     */
    static async getState(VMName) {
        let vmInfo = await this.driver.info(doc.name);
        return vmInfo.VMState.replace('"','');
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

    async bake(scriptPath, ansibleSSHConfig, verbose) {
        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));

        let dir = path.join(boxes, doc.name);

        // handle prompts for vm settings.
        if( doc.vm )
        {
            await Utils.traverse(doc.vm);
        }

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
            console.log( `Creating vm. ${doc.name}`);
            let mem = doc.vm.memory || 1024;
            let cpus = doc.vm.cpus || 2;
            let syncs = [`${slash(scriptPath)};/${path.basename(scriptPath)}`];
            // [...syncFolders, ...[{folder : {src: slash(scriptPath), dest: `/${path.basename(scriptPath)}`}}]]
            await vbox({provision: true, ip: doc.vm.ip, mem: mem, cpus: cpus, vmname: doc.name, syncs: syncs, verbose: true});
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

        await Servers.addToAnsibleHosts(ip, doc.name, ansibleSSHConfig, sshConfig, true)
        await this.setKnownHosts(ip, ansibleSSHConfig);
        await this.mkTemplatesDir(doc, ansibleSSHConfig);

        // prompt for passwords/vars
        if( doc.vars )
        {
            await Utils.traverse(doc.vars);
        }

        await Spinner.spinPromise(Ssh.sshExec(`sudo apt-get update`, sshConfig, false), `Running apt-get update on VM`, spinnerDot);

        // Installing stuff.
        let resolveB = require('../../bakelets/resolve');
        await resolveB.resolveBakelet(bakeletsPath, remotesPath, doc, scriptPath, verbose)

    }

    static async retrieveSSHConfigByName(name) {
        let vmSSHConfigUser = await this.getSSHConfig(name);
        return vmSSHConfigUser;
    }
}

module.exports = VirtualBoxProvider;
