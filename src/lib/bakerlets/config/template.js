
const { commands, modules } = require('../../../baker');
const baker = modules['baker'];

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
        this.src = obj.template.src;
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

