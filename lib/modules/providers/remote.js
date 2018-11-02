const fs       = require('fs-extra');
const path     = require('path');
const Provider = require('./provider');
const Servers  = new (require('../servers'))();
const Ssh      = require('../ssh');
const Utils    = require('../utils/utils');
const yaml     = require('js-yaml');

const { bakeletsPath, remotesPath } = require('../../../global-vars');

const child_process = require('child_process');

class RemoteProvider extends Provider {
    /**
     * @param {String} username ssh username for the remote host
     * @param {String} privateKey ssh key for sshing to the remote host
     * @param {String} hostname ip address of the remote host
     * @param {String} port=22 ssh port
     */
    constructor(user, private_key, hostname, port = 22) {
        super();
        this.sshConfig = {
            user,
            private_key,
            hostname,
            port
        }
    }

    async bake(scriptPath, ansibleSSHConfig, verbose) {
        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));

        try {
            // TODO: copy the ssh key to ${ip}_rsa instead of id_rsa
            await Ssh.copyFromHostToVM(
                this.sshConfig.private_key,
                `/home/vagrant/baker/${doc.name}/${this.sshConfig.hostname}_rsa`,
                ansibleSSHConfig
            );
            await Servers.addToAnsibleHosts(this.sshConfig.hostname, doc.name, ansibleSSHConfig, this.sshConfig);
            await this.setKnownHosts(this.sshConfig.hostname, ansibleSSHConfig);
            await this.mkTemplatesDir(doc, ansibleSSHConfig);

            // prompt for passwords
            if (doc.vars) {
                await Utils.traverse(doc.vars);
            }

            // Installing stuff.
            let resolveB = require('../../bakelets/resolve');
            await resolveB.resolveBakelet(bakeletsPath, remotesPath, doc, scriptPath, verbose);

        } catch (err) {
            throw err;
        }
    }

    /**
     * ssh to the environment
     */
    async ssh() {
        try {
            child_process.execSync(`ssh -i ${this.sshConfig.private_key} -o IdentitiesOnly=yes ${this.sshConfig.user}@${this.sshConfig.hostname}`, {
                stdio: ['inherit', 'inherit', 'inherit']
            });
        } catch (err) {
            throw err;
        }
    }

    /**
     * @param {String} bakePath path to the directory of baker.yml
     * @returns {Boolean} true if baker.yml is compatible with this provider, otherwise false
     */
    static async validateBakerYML(bakePath) {
        let doc = yaml.safeLoad(await fs.readFile(path.join(bakePath, 'baker.yml'), 'utf8'));
        if (doc.remote && doc.remote.ip && doc.remote.user && doc.remote.private_key)
            return true;
        else
            return false;
    }

    getSSHConfig() {
        return this.sshConfig;
    }

}

module.exports = RemoteProvider;
