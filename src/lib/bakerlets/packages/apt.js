const { commands, modules } = require('../../../baker');
const baker = modules['baker'];
const ssh = modules['ssh'];

const Bakerlet = require('../bakerlet');
const path = require('path');
const mustache = require('mustache');
const fs = require('fs-extra');

class Apt extends Bakerlet {
    constructor(name, ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;
    }

    async load(obj, variables) {
        this.variables = variables;

        if (obj.apt) {
            let type = typeof(obj.apt);
            if (type == 'string')
                    this.packages = obj.apt.trim().split(/\s*,\s*/g);
            else if(type = 'object')
                    this.packages = obj.apt;
        }

        let packagesObj = {'packages': this.packages.map(p => {return {'name': p}}) };
        let playbookTemplate = path.resolve(
            this.remotesPath,
            `bakerlets-source/packages/apt.yml.mustache`
        );
        let playbookRendered = mustache.render(await fs.readFileAsync(playbookTemplate, 'utf8'), packagesObj);

        let cmd = `echo "${playbookRendered.replace(/"/g, '\\"')}" > /home/vagrant/baker/${this.name}/apt.yml`;
        await this.exec(cmd);
    }

    async install() {
        var cmd = `apt.yml`;
        await baker.runAnsiblePlaybook(
            { name: this.name },
            cmd,
            this.ansibleSSHConfig,
            true,
            this.variables
        );
    }
}

module.exports = Apt;
