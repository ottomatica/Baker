const Promise       =      require('bluebird');
const child_process =      Promise.promisifyAll(require('child_process'));
const conf          =      require('../../modules/configstore');
const download      =      require('download');
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

const {boxes, bakeletsPath, remotesPath, privateKey, bakerSSHConfig} = require('../../../global-vars');

class RuncProvider extends Provider {
    constructor() {
        super();

        this.driver = this;
    }

    /**
     * Prune
     */
    static async prune() {
    }

    async list() {
    }

    /**
     * Starts an environment by name -- not supported in this provider
     * @param {String} name Name of the environment to be started
     * @param {boolean} verbose
     */
    async start(name, verbose = false) {
        await Spinner.spinPromise(Promise.resolve(), 'Start command is not supported for persistent environments.', spinnerDot);
    }

    /**
     * Shut down an environment by name -- not supported in this provider
     * @param {String} name Name of the VM to be halted
     * TODO: add force option
     */
    async stop(name, force = false) {
        await Spinner.spinPromise(Promise.resolve(), 'Stop command is not supported for persistent environments.', spinnerDot);
    }

    /**
     * Delete an environment
     * @param {String} name
     */
    async delete(name) {
        let bakerPath = `/mnt/disk/${name}`;
        let rootfsPath = `${bakerPath}/rootfs`;
        let cmd = `umount ${rootfsPath}/${path.basename(process.cwd())} ${rootfsPath}/proc ${rootfsPath}/dev/pts ${rootfsPath}/dev ${rootfsPath}/sys && rm -rf ${bakerPath}`;
        await Ssh.sshExec(cmd, bakerSSHConfig, 60000, true);
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
     * @param {String} name
     * @param {String} cmdToRun
     * @param {boolean} terminateProcessOnClose
     */
    async ssh(name, cmdToRun, terminateProcessOnClose) {
        await this.sshChroot(name, cmdToRun, terminateProcessOnClose);
    }

    async sshRunc (name) {
        try {
            let cmd = 'cd /mnt/disk/demo && runc run --no-pivot instance-0';
            child_process.execSync(`ssh -i ${privateKey} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes -p 6022 root@127.0.0.1 -t "${cmd}"`,  {stdio: ['inherit', 'inherit', 'ignore']});
        } catch(err) {
            throw err;
        }
    }

    async sshChroot(name, cmdToRun, terminateProcessOnClose) {
        try {
            let cmd = null;
            let rootfsPath = `/mnt/disk/${name}/rootfs`;
            if (!cmdToRun) {
                cmd = `chroot ${rootfsPath} /bin/bash`;
            } else {
                cmd = `chroot ${rootfsPath} bash -c "${cmdToRun}"`;
            }
            // Handling platform quoting style
            if( os.platform() == 'win32' )
            {
                // tripple quote for windows
                cmd = cmd.replace(/["]/g, '"""');
            }
            else
            {
                // surround all of cmd with '' in bash
                cmd = `'${cmd}'`;
            }

            child_process.execSync(`ssh -q -i ${privateKey} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes -p 6022 root@127.0.0.1 -tt ${cmd}`, { stdio: ['inherit', 'inherit', 'inherit'] });
        } catch (err) {
            throw err;
        }
    }

    async bake(scriptPath, ansibleSSHConfig, verbose) {
        await this.bakeChroot(scriptPath, verbose);
    }

    async bakeRunc(scriptPath, verbose) {
        var cmd = 'mkdir -p /mnt/disk/demo/rootfs; tar -xf /data/boxes/rootfs.tar -C /mnt/disk/demo/rootfs; cd /mnt/disk/demo && runc spec';
        await Ssh.sshExec(cmd, bakerSSHConfig, 60000, verbose);
    }

    async bakeChroot(scriptPath, verbose) {
        let boxesPath = path.join(boxes, 'boxes');
        if (! (await fs.exists(path.join(boxesPath, 'rootfs.tar')))) {
            await Spinner.spinPromise(download('https://github.com/ottomatica/baker-release/releases/download/0.6.1/rootfs.tar', boxesPath), 'Downloading Ubuntu 16.04 rootfs', spinnerDot);
        }

        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));
        let bakerPath = `/home/vagrant/baker/${doc.name}`;
        let rootfsPath = `/mnt/disk/${doc.name}/rootfs`;

        let mountPoints = [{
                                source: '/proc',
                                dest: `${rootfsPath}/proc`,
                                type: 'proc',
                                bind: false
                            }, {
                                source: '/sys',
                                dest: `${rootfsPath}/sys`,
                                type: 'sysfs',
                                bind: false
                            }, {
                                source: '/dev',
                                dest: `${rootfsPath}/dev`,
                                type: 'bind',
                                bind: true
                            }, {
                                source: '/dev/pts',
                                dest: `${rootfsPath}/dev/pts`,
                                type: 'devpts',
                                bind: false
                            }, {
                                source: (os.platform() == "win32") ? `/share${slash(path.resolve(scriptPath).split(':')[1])}` : `/share${scriptPath}`,
                                dest: `${rootfsPath}/${path.basename(process.cwd())}`,
                                type: 'bind',
                                bind: true
                            } ];
        let mounts = '';
        mountPoints.forEach(mountPoint => {
            mounts += `if ! mount | grep "${mountPoint.dest}" > /dev/null; then mkdir -p ${mountPoint.dest}; mount -t ${mountPoint.type} ${mountPoint.bind ? '--bind' : ''} ${mountPoint.source} ${mountPoint.dest}; fi; `;
        })

        var cmd = `mkdir -p ${bakerPath}; mkdir -p ${rootfsPath}; tar -xf /share/Users/${os.userInfo().username}/.baker/boxes/rootfs.tar -C ${rootfsPath}; echo 'nameserver 8.8.4.4' | tee -a ${rootfsPath}/etc/resolv.conf; ${mounts}`;
        await Ssh.sshExec(cmd, bakerSSHConfig, 60000, verbose);

        await this.addToAnsibleHosts(doc.name, rootfsPath);

        // prompt for passwords/vars
        if (doc.vars) {
            await Utils.traverse(doc.vars);
        }

        // Installing stuff.
        let resolveB = require('../../bakelets/resolve');
        await resolveB.resolveBakelet(bakeletsPath, remotesPath, doc, scriptPath, verbose);
    }

    static async retrieveSSHConfigByName(name) {
        let vmSSHConfigUser = await this.getSSHConfig(name);
        return vmSSHConfigUser;
    }

    /**
     *
     * @param {String} name
     * @param {String} rootfsPath
     */
    async addToAnsibleHosts (name, rootfsPath){
        return Ssh.sshExec(`echo "[chroots]\n${rootfsPath}\tansible_connection=chroot\tansible_user=root" > /home/vagrant/baker/${name}/baker_inventory`, bakerSSHConfig);
    }
}

module.exports = RuncProvider;
