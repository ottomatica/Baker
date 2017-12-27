const { commands, modules } = require('../../../baker');
const baker = modules['baker'];

const Bakerlet = require('../bakerlet');
const path = require('path');

class MySql extends Bakerlet {
    
    constructor(name,ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;

    }

    async load()
    {
        let playbook = path.resolve(this.remotesPath, `bakerlets-source/services/mysql/mysql${this.version}.yml`);
        await this.copy(playbook,`/home/vagrant/baker/${this.name}/mysql${this.version}.yml`);
    }

    async install()
    {
        var cmd = `mysql${this.version}.yml`;
        await baker.runAnsiblePlaybook(
            {name: this.name}, cmd, this.ansibleSSHConfig, true
        );
    }
}

module.exports = MySql;