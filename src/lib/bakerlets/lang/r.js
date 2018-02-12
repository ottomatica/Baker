const { commands, modules } = require('../../../baker');
const baker = modules['baker'];
const ssh = modules['ssh'];

const Bakerlet = require('../bakerlet');
const path = require('path');
const mustache = require('mustache');
const fs = require('fs-extra');

class R extends Bakerlet {
    constructor(name, ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;
    }

    async load(obj, variables) {
        this.variables = variables;

        if (obj.R) {
            if (obj.R.packages) {
                let type = typeof(obj.R.packages);
                if(type == 'string')
                    this.packages = obj.R.packages.trim().split(/\s*,\s*/g);
                else if(type = 'object')
                    this.packages = obj.R.packages;
            } else {
                this.packages = []
            }
        }

        let packagesObj = {'cran': this.packages.length!=0 ? true : false, 'packages': this.packages.map(p => `'${p}'`).join() };
        let playbookTemplate = path.resolve(
            this.remotesPath,
            `bakerlets-source/lang/R/r.yml.mustache`
        );
        let playbookRendered = mustache.render(await fs.readFileAsync(playbookTemplate, 'utf8'), packagesObj);

        let cmd = `echo "${playbookRendered.replace(/"/g, '\\"')}" > /home/vagrant/baker/${this.name}/r.yml`;
        await this.exec(cmd);
    }

    async install() {
        var cmd = `r.yml`;
        await baker.runAnsiblePlaybook(
            { name: this.name },
            cmd,
            this.ansibleSSHConfig,
            this.verbose,
            this.variables
        );
    }
}

module.exports = R;
