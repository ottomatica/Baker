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

        let cmd = `du -sh /mnt/disk/* | grep -v 'lost+found' `;
        let output = await Ssh.sshExec(cmd, bakerSSHConfig, 20000, false);
        let table = [];
        for (let line of output.split('\n') )
        {
            if( line )
            {
                let [size, location] = line.split('\t');
                if(!location.includes('GB.swap'))
                    table.push( {container: location.replace("/mnt/disk/",""), size: size});
            }
        }
        console.table("Baker containers:", table);
    }

    /**
     * Starts an environment by name -- not supported in this provider
     * @param {String} name Name of the environment to be started
     * @param {boolean} verbose
     */
    async start(name, verbose = false) {
        await Spinner.spinPromise(Promise.resolve(), 'Start command is not supported for container environments.', spinnerDot);
    }

    /**
     * Shut down an environment by name -- (stops all processes in chroot)
     * @param {String} name Name of the VM to be halted
     */
    async stop(name) {
        let bakerPath = `/mnt/disk/${name}`;

        let stopAllProcess = `lsof | grep ${bakerPath} | cut -f1 | sort -nu | xargs --no-run-if-empty kill -9`;
        await Ssh.sshExec(stopAllProcess, bakerSSHConfig, 20000, true);
    }

    /**
     * Delete an environment
     * @param {String} name
     */
    async delete(name) {
        let bakerPath = `/mnt/disk/${name}`;
        let rootfsPath = `${bakerPath}/rootfs`;

        await this.stop(name);

        // Stop all forwards...

        // Most important, umount share
        let umountShare = `if mount | grep "${rootfsPath}/${path.basename(process.cwd())}" > /dev/null; then umount ${rootfsPath}/${path.basename(process.cwd())}; fi;`;
        await Ssh.sshExec(umountShare, bakerSSHConfig, 20000, true)
            .catch( e => {throw e});


        // TODO: move this outside
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
                source: '/dev/pts',
                dest: `${rootfsPath}/dev/pts`,
                type: 'devpts',
                bind: false
            }, {
                source: '/dev',
                dest: `${rootfsPath}/dev`,
                type: 'bind',
                bind: true
            }];
        let cmd = '';
        mountPoints.forEach(mountPoint => {
            cmd += `if mount | grep "${mountPoint.dest}" > /dev/null; then umount -f ${mountPoint.dest}; fi;`;
        })
        cmd += `rm -rf ${bakerPath}`;
        // let cmd = `umount -f ${rootfsPath}/proc ${rootfsPath}/dev/pts ${rootfsPath}/dev ${rootfsPath}/sys && rm -rf ${bakerPath}`;
        await Ssh.sshExec(cmd, bakerSSHConfig, 20000, true);
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

    async sshChroot(name, cmdToRun, terminateProcessOnClose) {
        try {
            let cmd = this.prepareSSHCmd(name, cmdToRun, terminateProcessOnClose);
            // console.log(cmd);
            if( !cmdToRun )
            {
                await Ssh.SSH_Session(bakerSSHConfig, cmd);
            }
            else
            {
                // console.log('execute');
                await Ssh.sshExec(cmd, bakerSSHConfig, 20000, true, {pty:true});
            }
        } catch (err) {
            throw err;
        }
    }

    prepareSSHCmd (name, cmdToRun,terminateProcessOnClose)
    {
        let cmd = null;
        let rootfsPath = `/mnt/disk/${name}/rootfs`;
        let env = `PATH=/bin:/usr/bin:/sbin:/usr/sbin:/usr/local/bin`;
        if (!cmdToRun)
        {
            if( Ssh.useNative )
            {
                cmd = `echo '. ~/.bashrc; export PS1="\\u@${name}:$ "' > ${rootfsPath}/root/.baker.rc && chmod +x ${rootfsPath}/root/.baker.rc && ${env} chroot ${rootfsPath} /bin/bash --init-file /root/.baker.rc`;
            }
            else
            {
                // When not using native ssh, we need to write commands directly to stream provided by ssh2.
                // This means we want to hide some magic from user -- also, we want to make sure to escape process
                // when this one ends, so user doesn't have to double exit.
                cmd = `stty -echo\necho "stty echo;. ~/.bashrc; export PS1='\\u@${name}:$ '" > ${rootfsPath}/root/.baker.rc && chmod +x ${rootfsPath}/root/.baker.rc && ${env} chroot ${rootfsPath} /bin/bash --init-file /root/.baker.rc; exit\n`;
            }
        } else {
            cmd = `${env} chroot ${rootfsPath} /bin/bash -c "${cmdToRun}"`;
        }

        console.log(`Running: ${cmd}`);
        return cmd;
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
            await Spinner.spinPromise(download('https://github.com/ottomatica/baker-release/releases/download/latest-dev/rootfs.tar', boxesPath), 'Downloading Ubuntu 16.04 rootfs', spinnerDot);
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
                                dest: `${rootfsPath}/${path.basename(scriptPath)}`,
                                type: 'bind',
                                bind: true
                            } ];
        let mounts = '';
        mountPoints.forEach(mountPoint => {
            mounts += `if ! mount | grep "${mountPoint.dest}" > /dev/null; then mkdir -p ${mountPoint.dest}; mount -t ${mountPoint.type} ${mountPoint.bind ? '--bind' : ''} ${mountPoint.source} ${mountPoint.dest}; fi; `;
        })

        var prepareCmd = `mkdir -p ${bakerPath}; mkdir -p ${rootfsPath}; tar -xf /share/Users/${os.userInfo().username}/.baker/boxes/rootfs.tar -C ${rootfsPath}; echo 'nameserver 8.8.4.4' | tee -a ${rootfsPath}/etc/resolv.conf; ${mounts}`;
        await Ssh.sshExec(prepareCmd, bakerSSHConfig, 60000, verbose);

        var addHostsCmd = `echo "127.0.0.1 localhost loopback" >> ${rootfsPath}/etc/hosts`;
        await Ssh.sshExec(addHostsCmd, bakerSSHConfig, 60000, verbose);

        // make real /dev/null
        var makeDevNull = `rm -f ${rootfsPath}/dev/null && mknod -m 666 ${rootfsPath}/dev/null c 1 3`;
        await Ssh.sshExec(makeDevNull, bakerSSHConfig, 60000, verbose);

        // make connection within chroot so we can turn off /sbin/initctl
        await this.ssh(doc.name, `dpkg-divert --add --rename --local /sbin/initctl`, false );

        await this.addToAnsibleHosts(doc.name, rootfsPath);
        await this.mkTemplatesDir(doc, bakerSSHConfig);

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

    // Demo/test...
    async sshRunc (name) {
        try {
            let cmd = 'cd /mnt/disk/demo && runc run --no-pivot instance-0';
            child_process.execSync(`ssh -i ${privateKey} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes -p 6022 root@127.0.0.1 -t "${cmd}"`,  {stdio: ['inherit', 'inherit', 'ignore']});
        } catch(err) {
            throw err;
        }
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
