const { commands, modules } = require('../../../baker');
const baker = modules['baker'];

const Bakerlet = require('../bakerlet');
const path = require('path');

class Python extends Bakerlet {

    constructor(name, ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;

    }

    async load(obj, variables)
    {
        let playbook = path.resolve(this.remotesPath, `bakerlets-source/lang/python/python${this.version}.yml`);
        await this.copy(playbook, `/home/vagrant/baker/${this.name}/python${this.version}.yml`);
        this.variables = variables;
    }

    async install()
    {
        var cmd = `python${this.version}.yml`;
        await baker.runAnsiblePlaybook(
            {name: this.name}, cmd, this.ansibleSSHConfig, true, this.variables
        );
    }


}

module.exports = Python;
