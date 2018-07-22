const Bakelet = require('../bakelet');
const Baker   = require('../../modules/baker');
const Ansible   = require('../../modules/configuration/ansible');
const path    = require('path');

class Neo4j extends Bakelet {

    constructor(name,ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;

    }

    async load(obj, variables)
    {
        this.variables = variables;

        let playbook = path.resolve(this.remotesPath, `bakelets-source/services/neo4j/neo4j${this.version}.yml`);
        await this.copy(playbook,`/home/vagrant/baker/${this.name}/neo4j${this.version}.yml`);
    }

    async install()
    {
        var cmd = `neo4j${this.version}.yml`;
        await Ansible.runAnsiblePlaybook(
            {name: this.name}, cmd, this.ansibleSSHConfig, this.verbose, this.variables
        );
    }
}

module.exports = Neo4j;
