const Bakelet = require('../bakelet');
const Baker   = require('../../modules/baker');
const path    = require('path');

class Ansible extends Bakelet {

    constructor(name,ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;

    }

    async load(obj, variables)
    {
        let playbook = path.resolve(this.remotesPath, `bakelets-source/tools/ansible/ansible${this.version}.yml`);
        await this.copy(playbook, `/home/vagrant/baker/${this.name}/ansible${this.version}.yml`);
        this.variables = variables;
    }

    async install()
    {
        var cmd = `ansible${this.version}.yml`;
        await Baker.runAnsiblePlaybook(
            {name: this.name}, cmd, this.ansibleSSHConfig, this.verbose, this.variables
        );
    }


}

module.exports = Ansible;
