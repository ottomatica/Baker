const Bakelet = require('../bakelet');
const Ansible = require('../../modules/configuration/ansible');
const path    = require('path');

class Defects4J extends Bakelet {

    constructor(name,ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;

    }

    async load(obj, variables)
    {
        let playbook = path.resolve(this.remotesPath, `bakelets-source/tools/defects4j/defects4j${this.version}.yml`);
        await this.copy(playbook, `/home/vagrant/baker/${this.name}/defects4j${this.version}.yml`);
        this.variables = variables;
    }

    async install()
    {
        var cmd = `defects4j${this.version}.yml`;
        await Ansible.runAnsiblePlaybook(
            {name: this.name}, cmd, this.ansibleSSHConfig, this.verbose, this.variables
        );
    }


}

module.exports = Defects4J;
