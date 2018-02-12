
const { commands, modules } = require('../../../baker');
const baker = modules['baker'];
const ssh = modules['ssh'];

const Bakerlet = require('../bakerlet');
const path = require('path');

class Keys extends Bakerlet {

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
                let sshConfig = await baker.retrieveSSHConfigByName(clientName);
                if( sshConfig.private_key == undefined )
                {
                    throw `Could not retrieve ${clientName}'s ssh key`
                }

                await ssh.copyFromHostToVM(
                    sshConfig.private_key,
                    `/home/vagrant/baker/${this.name}/${clientName}_id_rsa`,
                    this.ansibleSSHConfig
                );
            }

            variables.push({baker_client_keys : obj.keys.map( k => `${k}_id_rsa`) });
            this.variables = variables;
            let playbook = path.resolve(this.remotesPath, `bakerlets-source/config/keys${this.version}.yml`);
            await this.copy(playbook,`/home/vagrant/baker/${this.name}/keys${this.version}.yml`);
        }
    }

    async install()
    {
        var cmd = `keys${this.version}.yml`;
        await baker.runAnsiblePlaybook(
            {name: this.name}, cmd, this.ansibleSSHConfig, this.verbose, this.variables
        );
    }


}

module.exports = Keys;

