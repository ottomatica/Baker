const Bakelet = require('../bakelet');
const Baker   = require('../../modules/baker');
const Ansible = require('../../modules/configuration/ansible');
const path    = require('path');
const Ssh     = require('../../modules/ssh');

class Template extends Bakelet {

    constructor(name,ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;
    }

    async load(obj, variables)
    {
        await Ssh.copyFromHostToVM(
            path.resolve(this.bakePath, obj.template.src),
            `/home/vagrant/baker/${this.name}/templates/`,
            this.ansibleSSHConfig,
            false
        );

        this.src = `templates/${path.basename(path.resolve(this.bakePath, obj.template.src))}`;
        console.log("template src", this.src)
        this.dest = obj.template.dest;
        this.variables = variables;
    }

    async install()
    {
        await Ansible.runAnsibleTemplateCmd(
            {name: this.name}, this.src, this.dest, this.variables, this.ansibleSSHConfig, this.verbose
        );
    }

}

module.exports = Template;

