const Bakelet = require('../bakelet');
const path    = require('path');

const { privateKey } = require('../../../global-vars');
const conf    = require('../../modules/configstore')

const Ansible = require('../../modules/configuration/ansible');
const VaultLib   = require('../../modules/vault');
const Ssh     = require('../../modules/ssh');

class Vault extends Bakelet {

    constructor(name,ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;
    }


    async promptPass()
    {
        return new Promise(function(resolve,reject)
        {
            var properties = [
                {
                name: 'password',
                hidden: true
                }
            ];
            
            prompt.start();
            
            prompt.get(properties, function (err, result) {
                if (err) { reject(err); }
                else
                {
                    resolve(result.password)
                }
            });    
        });
    }


    async load(obj, variables)
    {

        let passphraseKey = `vault:${process.cwd()}`;
        let passphrase = '';
        if (conf.has(passphraseKey))
        {
            passphrase = conf.get(passphraseKey);
        }
        else
        {
            passphrase = promptPass();
        }
        let vault = new VaultLib();

        if( Array.isArray(obj.vault) )
        {
            this.vault = obj.vault;
            this.variables = variables || {};

            for (let entry of obj.vault)
            {
                let file = path.join(this.bakePath, entry.file);
                let content = vault.retrieve(file, passphrase);

                await Ssh.writeContentToDest(content,
                    `/home/vagrant/baker/${this.name}/templates/${entry.file}`,
                    this.ansibleSSHConfig,
                    false
                );
            }
        }
    }

    async install()
    {
        if( this.vault )
        {
            for (let entry of this.vault)
            {
                await Ansible.runAnsibleTemplateCmd(
                    {name: this.name}, `/home/vagrant/baker/${this.name}/templates/${entry.file}`, 
                    entry.dest, this.variables, this.ansibleSSHConfig, this.verbose);
            }
        }
    }


}

module.exports = Vault;

