const Ssh = require('../ssh');

class Provider {
    constructor() {}

    async setKnownHosts(ip, sshConfig) {
        return Ssh.sshExec(`cd /home/vagrant/baker/ && ansible-playbook -i "localhost," registerhost.yml -e "ip=${ip}" -c local`, sshConfig);
    }

    async mkTemplatesDir(doc, ansibleSSHConfig) {
        return Ssh.sshExec(`mkdir -p /home/vagrant/baker/${doc.name}/templates`, ansibleSSHConfig);
    }
}

module.exports = Provider;
