const { commands, modules } = require('../../../baker');
const baker = modules['baker'];
const ssh = modules['ssh'];


const Bakerlet = require('../bakerlet');
const path = require('path');

class MongoDB extends Bakerlet {

    constructor(name,ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;

    }

    async load(obj, variables)
    {
        this.variables = variables;

        if( obj.mongodb )
        {
            if( obj.mongodb.version )
            {
                this.version = obj.mongodb.version;
            }
        }

        let playbook = path.resolve(this.remotesPath, `bakerlets-source/services/mongodb/mongodb${this.version}.yml`);
        await this.copy(playbook,`/home/vagrant/baker/${this.name}/mongodb${this.version}.yml`);
    }

    async install()
    {
        var cmd = `mongodb${this.version}.yml`;
        await baker.runAnsiblePlaybook(
            {name: this.name}, cmd, this.ansibleSSHConfig, true, this.variables
        );
    }
}

module.exports = MongoDB;
