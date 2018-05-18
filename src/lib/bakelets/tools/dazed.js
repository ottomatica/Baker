const Bakelet = require('../bakelet');
const Baker   = require('../../modules/baker');
const path    = require('path');

class Dazed extends Bakelet {

    constructor(name,ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;

    }

    async load(obj, variables)
    {
        let playbook = path.resolve(this.remotesPath, `bakelets-source/tools/dazed/dazed${this.version}.yml`);
        await this.copy(playbook, `/home/vagrant/baker/${this.name}/dazed${this.version}.yml`);
        this.variables = variables;
    }

    async install()
    {
        var cmd = `dazed${this.version}.yml`;
        await Baker.runAnsiblePlaybook(
            {name: this.name}, cmd, this.ansibleSSHConfig, this.verbose, this.variables
        );
    }


}

module.exports = Dazed;
