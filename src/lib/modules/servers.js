const Promise       = require('bluebird');
const child_process = require('child_process');
const conf          = require('../../lib/modules/configstore');
const download      = require('download');
const fs            = require('fs-extra');
const mustache      = require('mustache');
const path          = require('path');
const print         = require('./print');
const Ssh           = require('./ssh');
const Utils         = require('./utils/utils');
const vagrant       = Promise.promisifyAll(require('node-vagrant'));
const yaml          = require('js-yaml');
const Spinner       = require('../modules/spinner');
const spinnerDot    = conf.get('spinnerDot');

const vbox          =      require('node-virtualbox');
const VirtualboxProvider = require('./providers/virtualbox');
const VagrantProvider    = require('./providers/vagrant');
const VagrantProviderObj = new VagrantProvider();

const { configPath, ansible, boxes, bakerForMacPath, bakerSSHConfig } = require('../../global-vars');

class Servers {
    constructor() {}

    static async installBakerServer() {
        if (require('os').platform() === 'darwin') {
            await this.setupBakerForMac();
        } else {
            const provider = new VirtualboxProvider();

            // Ensure baker keys are installed.
            await Utils.copyFileSync(path.join(configPath, 'baker_rsa'), boxes, 'baker_rsa');
            await fs.chmod(path.join(boxes, 'baker_rsa'), '600');

            // TODO: check if virtualbox is installed
            if((await provider.driver.list()).filter(e => e.name === 'baker-srv').length == 0) {
                await vbox({
                    micro: true,
                    vmname: 'baker-srv',
                    port: bakerSSHConfig.port,
                    verbose: true
                });
            }
        }
    }

    // also in provider.vagrant
    /**
     * Adds the host url to /etc/hosts
     *
     * @param {String} ip
     * @param {String} name
     * @param {Object} sshConfig
     */
    static async addToAnsibleHosts (ip, name, ansibleSSHConfig, vmSSHConfig, usePython3){
        let pythonPath = usePython3 ? '/usr/bin/python3' : '/usr/bin/python';
        // TODO: Consider also specifying ansible_connection=${} to support containers etc.
        // TODO: Callers of this can be refactored to into two methods, below:
        return Ssh.sshExec(`echo "[${name}]\n${ip}\tansible_ssh_private_key_file=${ip}_rsa\tansible_user=${vmSSHConfig.user}\tansible_python_interpreter=${pythonPath}" > /home/vagrant/baker/${name}/baker_inventory && ansible all -i "localhost," -m lineinfile -a "dest=/etc/hosts line='${ip} ${name}' state=present" -c local --become`, ansibleSSHConfig);
    }

    static async setupBakerForMac(force=undefined){
        if(force){
            await fs.remove(bakerForMacPath);
        }

        await fs.ensureDir(bakerForMacPath);
        await Utils.copyFileSync(path.join(configPath, 'BakerForMac', 'vendor', 'hyperkit'), path.join(bakerForMacPath, 'vendor'), 'hyperkit');
        await fs.chmod(path.join(bakerForMacPath, 'vendor', 'hyperkit'), '511');
        await Utils.copyFileSync(path.join(configPath, 'BakerForMac', 'vendor', 'vpnkit.exe'), path.join(bakerForMacPath, 'vendor'), 'vpnkit.exe');
        await fs.chmod(path.join(bakerForMacPath, 'vendor', 'vpnkit.exe'), '511');
        await Utils.copyFileSync(path.join(configPath, 'BakerForMac', 'bakerformac.sh'), bakerForMacPath, 'bakerformac.sh');
        await fs.chmod(path.join(bakerForMacPath, 'bakerformac.sh'), '511');
        await Utils.copyFileSync(path.join(configPath, 'BakerForMac', 'hyperkitrun.sh'), bakerForMacPath, 'hyperkitrun.sh');
        await fs.chmod(path.join(bakerForMacPath, 'hyperkitrun.sh'), '511');

        // console.log('baker_rsa', await fs.readFile(path.join(configPath, 'baker_rsa'), 'utf8'));

        await Utils.copyFileSync(path.join(configPath, 'baker_rsa'), bakerForMacPath, 'baker_rsa');
        await fs.chmod(path.join(bakerForMacPath, 'baker_rsa'), '600');

        // download files if not available locally
        if (!(await fs.pathExists(path.join(bakerForMacPath, 'kernel')))) {
            await Spinner.spinPromise(download('https://github.com/ottomatica/baker-release/releases/download/0.6.0/kernel', bakerForMacPath), 'Downloading BakerForMac kernel', spinnerDot);
        }
        if (!(await fs.pathExists(path.join(bakerForMacPath, 'file.img.gz')))) {
            await Spinner.spinPromise(download('https://github.com/ottomatica/baker-release/releases/download/0.6.0/file.img.gz', bakerForMacPath), 'Downloading BakerForMac filesystem image', spinnerDot);
        }

        // only start server if not running
        child_process.execSync(`ps -fu $USER| grep "Library/Baker/BakerForMac/bakerformac.sh" | grep -v "grep" || screen -dm -S BakerForMac bash -c "${path.join(bakerForMacPath, 'bakerformac.sh')}"`, {stdio: ['ignore', 'ignore', 'inherit']});
    }


    // TODO: Temp: refactor to be able to use the docker bakelet instead
    static async installDocker(sshConfig) {
        return Ssh.sshExec(`cd /home/vagrant/baker/ && ansible-playbook -i "localhost," installDocker.yml -c local`, sshConfig, false);
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

                    await Utils.copyFileSync(path.join(configPath, './dockerHost/dockerConfig.yml'), path.join(dockerHostPath), 'dockerConfig.yml');
                    await Utils.copyFileSync(path.join(configPath, './dockerHost/lxd-bridge'), path.join(dockerHostPath), 'lxd-bridge');

                    await this.installDocker(baker);
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
}


module.exports = Servers;
