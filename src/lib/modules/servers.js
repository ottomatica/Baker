const Promise  = require('bluebird');
const fs       = require('fs-extra');
const mustache = require('mustache');
const path     = require('path');
const print    = require('./print');
const Ssh      = require('./ssh');
const Utils    = require('./utils/utils');
const vagrant  = Promise.promisifyAll(require('node-vagrant'));
const yaml     = require('js-yaml');

const VagrantProvider    = require('./providers/vagrant');
const VagrantProviderObj = new VagrantProvider();

const { configPath, ansible, boxes } = require('../../global-vars');

class Servers {
    /**
     * Checks if ansible server is up, if not it starts the server
     * It will also copy new vm's ansible script to ~/baker/{name}/ in ansible server
     */
    static async prepareAnsibleServer(bakerScriptPath) {
        let machine = vagrant.create({ cwd: ansible });
        let doc = yaml.safeLoad(await fs.readFile(path.join(bakerScriptPath, 'baker.yml'), 'utf8'));

        try {
            // let bakerVMID = await VagrantProvider.getVagrantID('baker');
            // let state = await this.getState(bakerVMID);
            let state = await VagrantProvider.getState('baker');
            if (state === 'running') {
                let ansibleSSHConfig = await VagrantProviderObj.getSSHConfig(machine);
                await Ssh.copyFilesForAnsibleServer(bakerScriptPath, doc, ansibleSSHConfig);
                return machine;
            } else {
                try {
                    await machine.upAsync();
                    // machine.on('up-progress', function(data) {
                    //     print.info(data);
                    // });
                } catch (err) {
                    throw err;
                }
                let ansibleSSHConfig = await this.getSSHConfig(machine);

                await Ssh.copyFilesForAnsibleServer(bakerScriptPath, doc, ansibleSSHConfig);

                return machine;
            }
        } catch (err) {
            if (err === `Cannot find machine: baker`) {
                throw `Baker control machine is not installed. run \`baker setup\` to install control machine`;
            } else {
                throw err;
            }
        }
    }


    /**
     * Make sure DockerVM exists
     * @param {String} custom name of the VM to be used as Docker host.
     *                          if undefined, usinig default Docker host.
     */
    static async prepareDockerVM(custom){
        if(!custom) {
            const dockerHostName = 'docker-srv';
            const dockerHostPath = path.join(boxes, dockerHostName);


            // console.log('dockerHostName', dockerHostName);
            // console.log('dockerHostPath', dockerHostPath)

            // preparing the ansibler server (needed for bakelets)
            // ansibleVM = await this.prepareAnsibleServer(bakePath); // need to ensure baker server is running?
            let ansibleVM = vagrant.create({ cwd: ansible });
            let ansibleSSHConfig = await VagrantProviderObj.getSSHConfig(ansibleVM);

            // ensure needed dir exist
            await Utils._ensureDir(boxes);
            await Utils._ensureDir(dockerHostPath);

            // always update vagrantfile
            let template = await fs.readFile(path.join(configPath, './dockerHost/DockerVM.mustache'), 'utf8');
            let vagrantfile = mustache.render(template, {dockerHostName});
            await fs.writeFile(path.join(dockerHostPath, 'Vagrantfile'), vagrantfile);

            let status;
            try{
                await VagrantProvider.getState('docker-srv')
                status = await VagrantProvider.getState('docker-srv');
            } catch(err){
                if (err == 'Cannot find machine: docker-srv') {
                    // Install baker-srv
                    await Utils._ensureDir(boxes);
                    await Utils._ensureDir(dockerHostPath);

                    await fs.copy(path.join(configPath, './dockerHost/dockerConfig.yml'), path.join(dockerHostPath, 'dockerConfig.yml'));
                    await fs.copy(path.join(configPath, './dockerHost/lxd-bridge'), path.join(dockerHostPath, 'lxd-bridge'));

                    await this.installDocker(ansibleSSHConfig);
                } else {
                    throw err;
                }
            }

            let machine = vagrant.create({ cwd: dockerHostPath });
            try {
                // TODO: Add a force reload option
                if(status != 'running'){
                    machine.on('up-progress', function(data) {
                        print.info(data);
                    });
                    await machine.upAsync();
                }
            } catch (err) {
                throw `Failed to start host VM: ${dockerHostName}\n${err}`;
            }
        } else {
            // TODO: custom docker hosts
            console.log('Docker-srv is running!')
        }
    }

    /**
     * Creates ansible server, if already doesn't exist
     */
    static async installAnsibleServer () {
        try {
            await fs.ensureDir(boxes);
            await fs.ensureDir(ansible);
        } catch (err) {
            throw err;
        }

        let machine = vagrant.create({ cwd: ansible });
        let bakerVMState;

        try {
            bakerVMState = await VagrantProvider.getState('baker');
            if(bakerVMState == 'running') return;
        } catch (err) {
            if (err === `Cannot find machine: baker`) {
                let template = await fs.readFile(path.join(configPath, './AnsibleVM.mustache'), 'utf8');
                let vagrantfile = mustache.render(template, require('../../config/AnsibleVM'));
                await fs.writeFile(path.join(ansible, 'Vagrantfile'), vagrantfile)

                await fs.copy(
                    path.resolve(configPath, './provision.shell.sh'),
                    path.resolve(ansible, 'provision.shell.sh')
                );
            } else {
                throw err;
            }
        }

        try {
            await machine.upAsync();
        } catch (err) {
            throw `Failed to start Baker control machine`;
        }

        // machine.on('up-progress', function(data) {
        //     print.info(data);
        // });

        return;
    }

    /**
     * Re-installs ansible server.
     * @returns Promise
     */
    static async reinstallAnsibleServer () {
        try {
            await (new VagrantProvider()).delete('baker');
        } catch (err) {
            if (err != `Cannot find machine: baker`) {
                throw err;
            }
        }
        await this.installAnsibleServer();
        return;
    }

    // TODO: Temp: refactor to be able to use the docker bakelet instead
    static async installDocker(sshConfig) {
        return Ssh.sshExec(`cd /home/vagrant/baker/ && ansible-playbook -i "localhost," installDocker.yml -c local`, sshConfig, false);
    }
}


module.exports = Servers;
