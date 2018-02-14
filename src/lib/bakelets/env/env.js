const { commands, modules } = require('../../../baker');
const baker = modules['baker'];
const ssh = modules['ssh'];

const Bakelet = require('../bakelet');
const path = require('path');
const mustache = require('mustache');
const fs = require('fs-extra');

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
        let playbookRendered = mustache.render(await fs.readFileAsync(playbookTemplate, 'utf8'), this.envVars);

        let cmd = `echo "${playbookRendered.replace(/"/g, '\\"')}" > /home/vagrant/baker/${this.name}/env.yml`;
        await this.exec(cmd);
    }

    async install() {
        var cmd = `env.yml`;
        await baker.runAnsiblePlaybook(
            { name: this.name },
            cmd,
            this.ansibleSSHConfig,
            this.verbose,
            this.variables
        );
    }
}

module.exports = Env;
