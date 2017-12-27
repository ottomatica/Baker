
const { commands, modules } = require('../../../baker');
const baker = modules['baker'];
const ssh = modules['ssh'];

const Bakerlet = require('../bakerlet');
const path = require('path');

class Template extends Bakerlet {
    
    constructor(name,ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;
    }

    async load(obj, variables)
    {
        await ssh.copyFromHostToVM(
            path.resolve(this.bakePath, obj.template.src),
            `/home/vagrant/baker/${this.name}`,
            this.ansibleSSHConfig,
            false
        );

        this.src = path.basename(obj.template.src);
        this.dest = obj.template.dest;
        this.variables = variables;
    }

    async install()
    {
        await baker.runAnsibleTemplateCmd(
            {name: this.name}, this.src, this.dest, this.variables, this.ansibleSSHConfig, true
        );
    }

}

module.exports = Template;

