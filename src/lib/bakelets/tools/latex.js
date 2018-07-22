const Bakelet = require('../bakelet');
const Baker   = require('../../modules/baker');
const Ansible   = require('../../modules/configuration/ansible');
const path    = require('path');

class Latex extends Bakelet {

    constructor(name, ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name    = name;
        this.version = version;
    }

    async load(obj, variables) {
        let playbook = path.resolve(this.remotesPath, `bakelets-source/tools/latex/latex${this.version}.yml`);
        await this.copy(playbook, `/home/vagrant/baker/${this.name}/latex${this.version}.yml`);
        this.variables = variables;
    }

    async install() {
        var cmd = `latex${this.version}.yml`;
        await Ansible.runAnsiblePlaybook({ name: this.name }, cmd, this.ansibleSSHConfig, this.verbose, this.variables);
    }
}

module.exports = Latex;
