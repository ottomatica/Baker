const Bakelet = require('../bakelet');
const Ansible = require('../../modules/configuration/ansible');
const path    = require('path');

class Jekyll extends Bakelet {

    constructor(name, ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name    = name;
        this.version = version;
    }

    async load(obj, variables) {
        let playbook = path.resolve(this.remotesPath, `bakelets-source/tools/jekyll/jekyll${this.version}.yml`);
        await this.copy(playbook, `/home/vagrant/baker/${this.name}/jekyll${this.version}.yml`);
        this.variables = variables;
    }

    async install() {
        var cmd = `jekyll${this.version}.yml`;
        await Ansible.runAnsiblePlaybook({ name: this.name }, cmd, this.ansibleSSHConfig, this.verbose, this.variables);
    }
}

module.exports = Jekyll;
