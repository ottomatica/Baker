const Bakelet = require('./bakelet');
const Ansible = require('../modules/configuration/ansible');
const path    = require('path');

class Custom extends Bakelet {

    constructor(name, ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;
    }

    async load(obj, variables) {
        let playbook = path.resolve(this.remotesPath, this.bakeletPath);
        await this.copy(playbook, `/home/vagrant/baker/${this.name}/${this.bakeletName}${this.version}.yml`);
        this.variables = variables;
    }

    async install() {
        var cmd = `${this.bakeletName}${this.version}.yml`;
        await Ansible.runAnsiblePlaybook(
            { name: this.name }, cmd, this.ansibleSSHConfig, this.verbose, this.variables
        );
    }

}

module.exports = Custom;
