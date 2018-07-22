const Bakelet = require('../bakelet');
const Baker   = require('../../modules/baker');
const Ansible   = require('../../modules/configuration/ansible');
const path    = require('path');

class Java extends Bakelet {

    constructor(name,ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;

    }

    async load(obj, variables)
    {
        //console.log("load", "java", this.version);
        //console.log("Copying files to baker VM");
        let playbook = path.resolve(this.remotesPath, `bakelets-source/lang/java/java${this.version}.yml`);
        await this.copy(playbook,`/home/vagrant/baker/${this.name}/java${this.version}.yml`);
        this.variables = variables;
    }

    async install()
    {
        var cmd = `java${this.version}.yml`;
        await Ansible.runAnsiblePlaybook(
            {name: this.name}, cmd, this.ansibleSSHConfig, this.verbose, this.variables
        );
        //console.log(`installed java ${this.version}`);
    }


}

module.exports = Java;
