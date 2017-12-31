const { commands, modules } = require('../../../baker');
const baker = modules['baker'];

const Bakerlet = require('../bakerlet');
const path = require('path');

class Nodejs extends Bakerlet {

    constructor(name, ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;

    }

    async load(obj, variables)
    {
        //console.log("load", "java", this.version);
        //console.log("Copying files to baker VM");
        let playbook = path.resolve(this.remotesPath, `bakerlets-source/lang/nodejs/nodejs${this.version}.yml`);
        await this.copy(playbook, `/home/vagrant/baker/${this.name}/nodejs${this.version}.yml`);
        this.variables = variables;
    }

    async install()
    {
        var cmd = `nodejs${this.version}.yml`;
        await baker.runAnsiblePlaybook(
            {name: this.name}, cmd, this.ansibleSSHConfig, true, this.variables
        );
        //console.log(`installed java ${this.version}`);
    }


}

module.exports = Nodejs;
