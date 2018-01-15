const { commands, modules } = require('../../../baker');
const baker = modules['baker'];
const ssh = modules['ssh'];


const Bakerlet = require('../bakerlet');
const path = require('path');

class Docker extends Bakerlet {
    
    constructor(name,ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;

    }

    async load(obj, variables)
    {
        this.variables = variables;

        let playbook = path.resolve(this.remotesPath, `bakerlets-source/services/docker/docker${this.version}.yml`);
        await this.copy(playbook,`/home/vagrant/baker/${this.name}/docker${this.version}.yml`);
    }

    async install()
    {
        var cmd = `docker${this.version}.yml`;
        await baker.runAnsiblePlaybook(
            {name: this.name}, cmd, this.ansibleSSHConfig, this.verbose, this.variables
        );
    }
}

module.exports = Docker;