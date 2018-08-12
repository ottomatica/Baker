const Promise       =      require('bluebird');
const _             =      require('underscore');
const child_process =      Promise.promisifyAll(require('child_process'));
const conf          =      require('../../modules/configstore');
const fs            =      require('fs-extra');
const os            =      require('os');
const path          =      require('path');
const Provider      =      require('./provider');
const slash         =      require('slash');
const Spinner       =      require('../../modules/spinner');
const spinnerDot    =      conf.get('spinnerDot');
const Ssh           =      require('../ssh');
const Utils         =      require('../utils/utils');
const yaml          =      require('js-yaml');

const vbox          =      require('node-virtualbox');
const VBoxProvider  =      require('node-virtualbox/lib/VBoxProvider');
const {boxes, bakeletsPath, remotesPath, configPath, privateKey} = require('../../../global-vars');


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
            let VMs = await this.driver.list();
            let table = [];
            // VMs = VMs.filter(VM => VM.cwd.includes('.baker/'));
            for( let vm of VMs)
            {
                let state = await this.getState(vm.name);
                table.push( {name: vm.name, state: state} );
            }

            console.table('\nBaker vms: ', table);
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
        let state = await this.getState(VMName);
        if( state == 'running' )
        {
            await this.stop(VMName);
        }
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
        Object.keys(vmInfo).forEach(key => {
            if(vmInfo[key].includes('guestssh')){
                port = parseInt( vmInfo[key].split(',')[3]);
            }
        });
        return {user: 'vagrant', port: port, host: machine, hostname: '127.0.0.1', private_key: privateKey};
    }

    /**
     * Returns State of a VM
     * @param {String} VMName
     */
    async getState(VMName) {
        let vmInfo = await this.driver.info(VMName);
        return vmInfo.VMState.replace(/"/g,'');
    }

    /**
     * It will ssh to the vagrant box
     * @param {String} name
     * @param {String} cmdToRun
     * @param {boolean} terminateProcessOnClose
     */
    async ssh(name, cmdToRun, terminateProcessOnClose) {
        try {
            let info = await this.getSSHConfig(name);
            // hack
            //let key = path.join(require('os').tmpdir(), `${name}-key`);
            //fs.copyFileSync(info.private_key, key );
            //ßfs.chmod(key, "600");

            if( !cmdToRun )
            {
                child_process.execSync(`ssh -q -i ${info.private_key} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes -p ${info.port} ${info.user}@127.0.0.1`, {stdio: ['inherit', 'inherit', 'ignore']});
            }
            else
            {
                let allocateTTY = "";
                if( terminateProcessOnClose )
                {
                    cmdToRun = `shopt -s huponexit; ${cmdToRun}`;
                    allocateTTY = '-tt';
                }
                let sshCmd = `ssh -q -i ${info.private_key} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes -p ${info.port} ${info.user}@127.0.0.1 ${allocateTTY} "${cmdToRun}"`;
                //console.log( sshCmd );
                child_process.execSync(sshCmd, {stdio: ['inherit', 'inherit', 'inherit']});
            }
        } catch(err) {
            throw err;
        }
    }

    async bake(scriptPath, ansibleSSHConfig, verbose) {
        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));

        let dir = path.join(boxes, doc.name);

        // Allow override of vm from persistent
        if( doc.persistent )
        {
            doc.vm = doc.persistent;
        }

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
            await Utils.copyFileSync(path.join(configPath, 'baker_rsa.pub'), os.tmpdir(), 'baker_rsa.pub');
            await vbox({
                provision: true,
                ip: doc.vm.ip,
                mem: mem,
                cpus: cpus,
                vmname: doc.name,
                syncs: syncs,
                forward_ports: doc.vm.ports ? typeof (doc.vm.ports) === 'object' ? doc.vm.ports : String(doc.vm.ports).replace(/\s/g, '').split(',') : undefined,
                add_ssh_key: path.join(os.tmpdir(), 'baker_rsa.pub'),
                verbose: true
            });
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

        await this.addToAnsibleHosts(ip, doc.name, ansibleSSHConfig, sshConfig, true)
        await this.setKnownHosts(ip, ansibleSSHConfig);
        await this.mkTemplatesDir(doc, ansibleSSHConfig);

        // prompt for passwords/vars
        if( doc.vars )
        {
            await Utils.traverse(doc.vars);
        }

        await Spinner.spinPromise(Ssh.sshExec(`sudo apt-get update`, sshConfig, 20000, false), `Running apt-get update on VM`, spinnerDot);

        // Installing stuff.
        let resolveB = require('../../bakelets/resolve');
        await resolveB.resolveBakelet(bakeletsPath, remotesPath, doc, scriptPath, verbose)

    }

    static async retrieveSSHConfigByName(name) {
        let vmSSHConfigUser = await this.getSSHConfig(name);
        return vmSSHConfigUser;
    }

    // also in servers.js
    /**
     * Adds the host url to /etc/hosts
     *
     * @param {String} ip
     * @param {String} name
     * @param {Object} sshConfig
     */
    async addToAnsibleHosts (ip, name, ansibleSSHConfig, vmSSHConfig, usePython3){
        let pythonPath = usePython3 ? '/usr/bin/python3' : '/usr/bin/python';
        return Ssh.sshExec(`echo "[${name}]\n${ip}\tansible_ssh_private_key_file=${ip}_rsa\tansible_user=${vmSSHConfig.user}\tansible_python_interpreter=${pythonPath}" > /home/vagrant/baker/${name}/baker_inventory && ansible all -i "localhost," -m lineinfile -a "dest=/etc/hosts line='${ip} ${name}' state=present" -c local --become`, ansibleSSHConfig);
    }
}

module.exports = VirtualBoxProvider;
