const Bakelet = require('../bakelet');
const Ansible = require('../../modules/configuration/ansible');
const path    = require('path');
const Ssh     = require('../../modules/ssh');

const { privateKey } = require('../../../global-vars');

class Keys extends Bakelet {

    constructor(name,ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;
    }

    async load(obj, variables)
    {
        if( Array.isArray(obj.keys) )
        {
            for (let clientName of obj.keys)
            {
                await Ssh.copyFromHostToVM(
                    privateKey,
                    `/home/vagrant/baker/${this.name}/${clientName}_id_rsa`,
                    this.ansibleSSHConfig
                );
            }

            variables.push({baker_client_keys : obj.keys.map( k => `${k}_id_rsa`) });
            this.variables = variables;
            let playbook = path.resolve(this.remotesPath, `bakelets-source/config/keys${this.version}.yml`);
            await this.copy(playbook,`/home/vagrant/baker/${this.name}/keys${this.version}.yml`);
        }
    }

    async install()
    {
        var cmd = `keys${this.version}.yml`;
        await Ansible.runAnsiblePlaybook(
            {name: this.name}, cmd, this.ansibleSSHConfig, this.verbose, this.variables
        );
    }


}

module.exports = Keys;

