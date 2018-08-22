const Promise       = require('bluebird');
const child_process = require('child_process');
const { promisify } = require('util');
const execAsync     = promisify(child_process.exec);
const conf          = require('../../lib/modules/configstore');
const download      = require('download');
const fs            = require('fs-extra');
const md5File       = require('md5-file/promise')
const mustache      = require('mustache');
const os            = require('os');
const path          = require('path');
const print         = require('./print');
const Spinner       = require('../modules/spinner');
const spinnerDot    = conf.get('spinnerDot');
const Ssh           = require('./ssh');
const Utils         = require('./utils/utils');
const vagrant       = Promise.promisifyAll(require('node-vagrant'));

const vbox               = require('node-virtualbox');
const VBoxProvider       = require('node-virtualbox/lib/VBoxProvider');
const VirtualboxProvider = require('./providers/virtualbox');
const VagrantProvider    = require('./providers/vagrant');
const VagrantProviderObj = new VagrantProvider();

const { configPath, boxes, bakerForMacPath, bakerSSHConfig } = require('../../global-vars');

class Servers {
    constructor() {}

    static async stopBakerServer(forceVirtualBox = false) {
        if (require('os').platform() === 'darwin' && !forceVirtualBox) {
            try {
                await execAsync(`ps aux | grep -v grep | grep "${path.join(bakerForMacPath, 'bakerformac.sh')}" | awk '{print $2}' | xargs kill`);
                await execAsync(`ps aux | grep -v grep | grep "${path.join(bakerForMacPath, 'vendor', 'vpnkit.exe')}" | awk '{print $2}' | xargs kill`);
                await execAsync(`launchctl unload ${path.join(bakerForMacPath, '9pfs.plist')} 2> /dev/null`);
            } catch (err) {
                console.error(err);
            }
        } else {
            if (require('os').platform() === 'darwin')
                console.log('=> Using virtualbox as hypervisor for Baker VM.');
            if((await (new VBoxProvider()).getState('baker-srv')) === 'running')
                await vbox({stopCmd: true, vmname: 'baker-srv', syncs: [], verbose: false}).catch( e => e );
        }
    }

    static async installBakerServer(forceVirtualBox = false) {
        if (require('os').platform() === 'darwin' && !forceVirtualBox) {
            await this.setupBakerForMac();
        } else {
            if (require('os').platform() === 'darwin')
                console.log('=> Using virtualbox as hypervisor for Baker VM.')

            const provider = new VirtualboxProvider();

            // Ensure baker keys are installed.
            await Utils.copyFileSync(path.join(configPath, 'baker_rsa'), boxes, 'baker_rsa');
            await fs.chmod(path.join(boxes, 'baker_rsa'), '600');

            // TODO: check if virtualbox is installed
            let root = (os.platform() == "win32") ? `${process.cwd().split(path.sep)[0]}/` : "/";
            if ((await provider.driver.list()).filter(e => e.name === 'baker-srv').length == 0) {
                await vbox({
                    micro: true,
                    vmname: 'baker-srv',
                    mem: 1024,
                    ssh_port: bakerSSHConfig.port,
                    syncs: [`${root};/data`],
                    disk: true,
                    verbose: true
                });
            } else {
                await vbox({start: true, vmname: 'baker-srv', syncs: [], verbose: true});
            }

            // TODO: mounting /data / share
            let mount = `if ! mount | grep "/share" > /dev/null; then mkdir -p /share; mount --bind /data /share; fi; `;
            await Ssh.sshExec(mount, bakerSSHConfig, 60000, false);
        }

        // add swap (swappiness = 40)
        let swap = `if [ ! -f /mnt/disk/2GB.swap ] ; then fallocate -l 2G /mnt/disk/2GB.swap && mkswap /mnt/disk/2GB.swap; fi; if ! cat /proc/swaps | grep "2GB.swap"; then mkdir -p /mnt/etc/ && touch /mnt/etc/fstab && echo -e "/mnt/disk/2GB.swap  none  swap  sw 0  0" >> /mnt/etc/fstab; swapon /mnt/disk/2GB.swap; fi;`;
        let swappiness = `sysctl -w vm.swappiness=40 ; if ! cat /etc/sysctl.conf | grep "vm.swappiness"; then echo "vm.swappiness=40" >> /etc/sysctl.conf; else sed -i "s/^vm.swappiness=.*/vm.swappiness=40/" /etc/sysctl.conf; fi;`;
        await Ssh.sshExec(swap + swappiness, bakerSSHConfig, 60000, false);
    }

    // also in provider.vagrant
    /**
     * Adds the host url to /etc/hosts
     *
     * @param {String} ip
     * @param {String} name
     * @param {Object} sshConfig
     */
    static async addToAnsibleHosts(ip, name, ansibleSSHConfig, vmSSHConfig, usePython3) {
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
        await Utils.copyFileSync(path.join(configPath, 'BakerForMac', 'vendor', 'hyperkit'), path.join(bakerForMacPath, 'vendor'), 'hyperkit', '894b60e65a10ceaa343f8bd7562563b7');
        await fs.chmod(path.join(bakerForMacPath, 'vendor', 'hyperkit'), '710');
        await Utils.copyFileSync(path.join(configPath, 'BakerForMac', 'vendor', 'vpnkit.exe'), path.join(bakerForMacPath, 'vendor'), 'vpnkit.exe', 'c415a968a9b51787f1505e24991726d5');
        await fs.chmod(path.join(bakerForMacPath, 'vendor', 'vpnkit.exe'), '710');
        await Utils.copyFileSync(path.join(configPath, 'BakerForMac', 'vendor', 'u9fs'), path.join(bakerForMacPath, 'vendor'), 'u9fs', 'e9189eb4f8e89e232534cffa3cc71856');
        await fs.chmod(path.join(bakerForMacPath, 'vendor', 'u9fs'), '710');
        await Utils.copyFileSync(path.join(configPath, 'BakerForMac', 'bakerformac.sh'), bakerForMacPath, 'bakerformac.sh', '3de3ac68d388d772c07645d13e6bc357');
        await fs.chmod(path.join(bakerForMacPath, 'bakerformac.sh'), '710');
        await Utils.copyFileSync(path.join(configPath, 'BakerForMac', 'hyperkitrun.sh'), bakerForMacPath, 'hyperkitrun.sh', 'bcfd28980e8516c424a72197b45f9d38');
        await fs.chmod(path.join(bakerForMacPath, 'hyperkitrun.sh'), '710');

        let plistPath = path.join(bakerForMacPath, '9pfs.plist');
        if(fs.exists(plistPath)) {
            let template = await fs.readFile(path.join(configPath, 'BakerForMac', '9pfs.plist.mustache'), 'utf8');
            let plist = mustache.render(template, {username: os.userInfo().username, exe: path.join(bakerForMacPath, 'vendor', 'u9fs').toString()});
            await fs.writeFile(plistPath, plist);
        }

        // console.log('baker_rsa', await fs.readFile(path.join(configPath, 'baker_rsa'), 'utf8'));

        await Utils.copyFileSync(path.join(configPath, 'baker_rsa'), bakerForMacPath, 'baker_rsa', 'aeae0ca92a41dc4d69901537a9aec7d8');
        await fs.chmod(path.join(bakerForMacPath, 'baker_rsa'), '600');

        // download files if not available locally
        let kernelPath = path.join(bakerForMacPath, 'kernel');
        if (!(await fs.pathExists(kernelPath)) || (await md5File(kernelPath)) != '67d58c298334a8f79998176fd8f0618c') {
            await Spinner.spinPromise(download('https://github.com/ottomatica/baker-release/releases/download/latest-dev/kernel', bakerForMacPath), 'Downloading BakerForMac kernel', spinnerDot);
        }
        let fsPath = path.join(bakerForMacPath, 'file.img.gz');
        if (!(await fs.pathExists(fsPath))  || (await md5File(fsPath)) != '512fe418f0b71ddfb3d7354a2a611db6') {
            await Spinner.spinPromise(download('https://github.com/ottomatica/baker-release/releases/download/latest-dev/file.img.gz', bakerForMacPath), 'Downloading BakerForMac filesystem image', spinnerDot);
        }

        // only start server if not running
        child_process.execSync(`ps -fu $USER| grep "Library/Baker/BakerForMac/bakerformac.sh" | grep -v "grep" || screen -dm -S BakerForMac bash -c "${path.join(bakerForMacPath, 'bakerformac.sh')}"`, {stdio: ['ignore', 'ignore', 'inherit']});
    }


    // TODO: Temp: refactor to be able to use the docker bakelet instead
    static async installDocker(sshConfig) {
        return Ssh.sshExec(`cd /home/vagrant/baker/ && ansible-playbook -i "localhost," installDocker.yml -c local`, sshConfig, 20000, false);
    }

    /**
     * Make sure DockerVM exists
     * @param {String} custom name of the VM to be used as Docker host.
     *                          if undefined, usinig default Docker host.
     */
    static async prepareDockerVM(custom) {
        if (!custom) {
            const dockerHostName = 'docker-srv';
            const dockerHostPath = path.join(boxes, dockerHostName);


            // console.log('dockerHostName', dockerHostName);
            // console.log('dockerHostPath', dockerHostPath)

            // ensure needed dir exist
            await Utils._ensureDir(boxes);
            await Utils._ensureDir(dockerHostPath);

            // always update vagrantfile
            let template = await fs.readFile(path.join(configPath, './dockerHost/DockerVM.mustache'), 'utf8');
            let vagrantfile = mustache.render(template, { dockerHostName });
            await fs.writeFile(path.join(dockerHostPath, 'Vagrantfile'), vagrantfile);

            let status;
            try {
                await VagrantProvider.getState('docker-srv');
                status = await VagrantProvider.getState('docker-srv');
            } catch (err) {
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
                if (status != 'running') {
                    machine.on('up-progress', function (data) {
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
