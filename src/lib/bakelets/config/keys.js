const Bakelet = require('../bakelet');
const Baker   = require('../../modules/baker');
const path    = require('path');
const Ssh     = require('../../modules/ssh');

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
                let sshConfig = await Baker.retrieveSSHConfigByName(clientName);
                if( sshConfig.private_key == undefined )
                {
                    throw `Could not retrieve ${clientName}'s ssh key`
                }

                await Ssh.copyFromHostToVM(
                    sshConfig.private_key,
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
        await Baker.runAnsiblePlaybook(
            {name: this.name}, cmd, this.ansibleSSHConfig, this.verbose, this.variables
        );
    }


}

module.exports = Keys;

