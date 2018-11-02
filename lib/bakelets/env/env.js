const Bakelet  = require('../bakelet');
const Ansible  = require('../../modules/configuration/ansible');
const fs       = require('fs-extra');
const mustache = require('mustache');
const path     = require('path');

class Env extends Bakelet {
    constructor(name, ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;
    }

    async load(obj, variables) {
        this.variables = variables;
        this.envVars = {env: []};

        obj.env.forEach( e => {
            this.envVars.env.push({KEY: Object.keys(e)[0], VALUE: Object.values(e)[0]})
        })

        let playbookTemplate = path.resolve(
            this.remotesPath,
            `bakelets-source/env/env.yml.mustache`
        );
        let playbookRendered = mustache.render(await fs.readFile(playbookTemplate, 'utf8'), this.envVars);

        let cmd = `echo "${playbookRendered.replace(/"/g, '\\"')}" > /home/vagrant/baker/${this.name}/env.yml`;
        await this.exec(cmd);
    }

    async install() {
        var cmd = `env.yml`;
        await Ansible.runAnsiblePlaybook(
            { name: this.name },
            cmd,
            this.ansibleSSHConfig,
            this.verbose,
            this.variables
        );
    }
}

module.exports = Env;
