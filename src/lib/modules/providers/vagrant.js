const Promise = require('bluebird');
const vagrant       = Promise.promisifyAll(require('node-vagrant'));
const child_process = require('child_process');
const path          = require('path');
const yaml = require('js-yaml');
const fs = Promise.promisifyAll(require('fs-extra'));
const slash = require('slash')
const mustache = require('mustache');
const {ansible, configPath} = require('../../../global-vars');
const Utils = require('../utils/utils');

class Vagrant {
    constructor(VMPath) {
        this.ansibleSevrer = vagrant.create({cwd: ansible});
        this.VMPath = VMPath;
        this.machine = vagrant.create({ cwd: VMPath });
    }

    async initVagrantFile (scriptPath) {
        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));
        let template = await fs.readFile(path.join(configPath, './BaseVM.mustache'), 'utf8');
        let vagrantFilePath = path.resolve(this.VMPath, 'Vagrantfile');

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

    async start(verbose=false){
        this.machine.on('up-progress', function(data) {
            //console.log(machine, progress, rate, remaining);
            if( verbose ) print.info(data);
        });

        try {
            await this.machine.upAsync();
        } catch (err){
            throw `Failed to start machine ${VMName}`;
        }
    }

    static async start(VMName, verbose=false){
        let machine = await getMachine(VMName);
        machine.on('up-progress', function(data) {
            if( verbose ) print.info(data);
        });

        try {
            await machine.upAsync();
        } catch(err){
            throw `Failed to start machine ${VMName}`;
        }
    }

    async stop(){
        try {
            await this.machine.haltAsync();
        } catch (err){
            throw `Failed to shutdown machine ${VMName}`;
        }
    }

    static async stop(VMName){
        try {
            let machine = await getMachine(VMName);

            try {
                await machine.haltAsync();
            } catch (err){
                throw `Failed to shutdown machine ${VMName}`;
            }
        } catch (err) {
            throw err;
        }

        return;
    }

    async delete(){
        try {
            await this.machine.destroyAsync();
        } catch (err){
            throw `Failed to destroy machine ${VMName}`;
        }
    }

    /**
     * Destroy VM
     * @param {String} VMName
     */
    static async delete (VMName) {
        let machine = await this.getMachine(VMName);

        try {
            await machine.destroyAsync();
        } catch (err){
            throw `Failed to destroy machine ${VMName}`;
        }
    }

    /**
     * Get ssh configurations
     * @param {String} nodeName Optionally give name of machine when multiple machines declared in single Vagrantfile.
     */
    async getSSHConfig(nodeName){
        try {
            let sshConfig = await this.machine.sshConfigAsync();
            if(sshConfig && sshConfig.length > 0) {
                if( nodeName ) {
                    for( var i = 0; i < sshConfig.length; i++ ) {
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
    static async getVMPath(VMName){
        let VMs = await vagrant.globalStatusAsync();
        let VM = VMs.find(VM => VM.name === VMName);

        if(VM)
            return VM.cwd;
        else
            throw `Cannot find machine: ${VMName}`;
    }

    static async getMachine(VMName){
        let VMPath = await this.getVMPath(VMName);
        return vagrant.create({ cwd: VMPath });
    }

    /**
     * Returns vagrant id of VMs by name
     * @param {String} VMName
     */
    static async getVagrantID(VMName){
        let VMs = await vagrant.globalStatusAsync();
        let VM = VMs.find(VM => VM.name == VMName);

        if(!VM)
            throw  `Cannot find machine: ${VMName}`;
        return VM.id;
    }

    /**
     * Returns State of the VM
     */
    async getState() {
        // let id = await this.getVagrantIDByName('baker');

        // try {
        //     let VMs = await vagrant.globalStatusAsync();
        //     let VM = VMs.find(VM => VM.id == id);
        //     if(!VM)
        //         throw  `Cannot find machine: ${id}`;
        //     return VM.state;
        // } catch (err) {
        //     throw err;
        // }
    }

    /**
     * Returns State of a VM
     * @param {String} VMName
     */
    static async getState(VMName) {
        try {
            let VMs = await vagrant.globalStatusAsync();
            let VM = VMs.find(VM => VM.name == name);
            if(!VM)
                throw  `Cannot find machine: ${id}`;
            return VM.state;
        } catch (err) {
            throw err;
        }
    }



}

module.exports = Vagrant;
