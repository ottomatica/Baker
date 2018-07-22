const Promise       = require('bluebird');
const conf          = require('./configstore');
const fs            = require('fs-extra');
const inquirer      = require('inquirer');
const mustache      = require('mustache');
const netaddr       = require('netaddr');
const path          = require('path');
const print         = require('./print');
const Provider      = require('../modules/providers/provider');
const spinner       = require('./Spinner');
const Ssh           = require('./ssh');
const Utils         = require('./utils/utils');
const vagrant       = Promise.promisifyAll(require('node-vagrant'));
const validator     = require('validator');
const yaml          = require('js-yaml');

const VagrantProvider = require('./providers/vagrant');
const VirtualBoxProvider = require('./providers/virtualbox');
const DockerProvider  = require('./providers/docker');
const DO_Provider     = require('./providers/digitalocean');
const RemoteProvider  = require('./providers/remote');

// conf variables:
const spinnerDot = conf.get('spinnerDot');

const { configPath, ansible, boxes, bakeletsPath, remotesPath } = require('../../global-vars');

class Ansible {

    static async runAnsibleVault (doc, pass, dest, ansibleSSHConfig) {
        return new Promise( async (resolve, reject) => {
            let key = doc.bake.vault.checkout.key;
            await Ssh.sshExec(`cd /home/vagrant/baker/${doc.name} && echo "${pass}" > vault-pwd`, ansibleSSHConfig);
            await Ssh.sshExec(`cd /home/vagrant/baker/${doc.name} && ansible-playbook -e "vault=${doc.name}/baker-vault.yml key=${key} dest=${dest}" -i baker_inventory --vault-password-file=vault-pwd ../CheckoutFromVault.yml`, ansibleSSHConfig)
            //await sshExec(`cd /home/vagrant/baker/${doc.name} && echo "${pass}" > vault-pwd &&  ansible-vault view baker-vault.yml --vault-password-file=vault-pwd > checkout.key`, sshConfig);
            //await sshExec(`cd /home/vagrant/baker/${doc.name} && ansible all -i baker_inventory --private-key id_rsa -u ${vmSSHConfigUser.user} -m copy -a "src=checkout.key dest=${dest} mode=0600"`, sshConfig)
            await Ssh.sshExec(`cd /home/vagrant/baker/${doc.name} && rm vault-pwd`, ansibleSSHConfig)
            resolve();
        });
    }

    // TODO: Need to be cleaning cmd so they don't do things like
    // ; sudo rm -rf / on our server...
    static async runAnsiblePlaybook (doc, cmd, ansibleSSHConfig, verbose, variables) {
        let flatVars = {};
        for( var i =0; i < variables.length; i++ )
        {
            for( var key in variables[i] )
            {
                flatVars[key] = variables[i][key];
            }
        }
        let extravars = JSON.stringify(flatVars);
        //let extravars = yaml.dump(variables);
        if( verbose ) console.log( extravars );
        // return Ssh.sshExec(`export ANSIBLE_HOST_KEY_CHECKING=false && cd /home/vagrant/baker/${doc.name} && ansible all -m ping -i baker_inventory`, ansibleSSHConfig, verbose);
        return Ssh.sshExec(`export ANSIBLE_HOST_KEY_CHECKING=false && cd /home/vagrant/baker/${doc.name} && echo '${extravars}' > playbook.args.json && ansible-playbook -e @playbook.args.json -i baker_inventory ${cmd}; rm -f playbook.args.json`, ansibleSSHConfig, verbose);
    }

    static async runAnsibleAptInstall (doc, cmd, ansibleSSHConfig,verbose) {
        return Ssh.sshExec(`export ANSIBLE_HOST_KEY_CHECKING=false && cd /home/vagrant/baker/${doc.name} && ansible all -m apt -a "pkg=${cmd} update_cache=yes cache_valid_time=86400" -i baker_inventory --become`, ansibleSSHConfig, verbose);
    }

    static async runAnsiblePipInstall (doc, requirements, ansibleSSHConfig, verbose) {
        return Ssh.sshExec(`export ANSIBLE_HOST_KEY_CHECKING=false && cd /home/vagrant/baker/${doc.name} && ansible all -m pip -a "requirements=${requirements}" -i baker_inventory --become`, ansibleSSHConfig, verbose);
    }

    static async runAnsibleNpmInstall (doc, packagejson, ansibleSSHConfig, verbose) {
        return Ssh.sshExec(`export ANSIBLE_HOST_KEY_CHECKING=false && cd /home/vagrant/baker/${doc.name} && ansible all -m npm -a "path=${packagejson}" -i baker_inventory`, ansibleSSHConfig, verbose);
    }

    static async runAnsibleTemplateCmd (doc, src, dest, variables, ansibleSSHConfig, verbose) {
        let flatVars = {};
        for( var i =0; i < variables.length; i++ )
        {
            for( var key in variables[i] )
            {
                flatVars[key] = variables[i][key];
            }
        }
        let extravars = JSON.stringify(flatVars);
        //let extravars = yaml.dump(variables);
        return Ssh.sshExec(`export ANSIBLE_HOST_KEY_CHECKING=false && cd /home/vagrant/baker/${doc.name} && echo '${extravars}' > template.args.json && ansible all -m template -a "src=${src} dest=${dest}" -e @template.args.json -i baker_inventory; rm -f template.args.json`, ansibleSSHConfig, verbose);
    }

}

module.exports = Ansible;

