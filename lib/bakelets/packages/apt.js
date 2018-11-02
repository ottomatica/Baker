const Bakelet  = require('../bakelet');
const Ansible  = require('../../modules/configuration/ansible');
const fs       = require('fs-extra');
const mustache = require('mustache');
const path     = require('path');

class Apt extends Bakelet {
    constructor(name, ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;
    }

    async load(obj, variables) {
        this.variables = variables;
        this.packages = {default: [], deb: [], ppa: []};

        // console.log('obj', obj.apt);
        if (obj.apt) {
            let type = typeof(obj.apt);
            if (type == 'string')
                this.packages.default = obj.apt.trim().split(/\s*,\s*/g);
            else if(type == 'object'){
                obj.apt.forEach(pkg => {
                    if(typeof(pkg) == 'object' && pkg[Object.keys(pkg)[0]].deb){
                        let name = Object.keys(pkg)[0];
                        this.packages.deb.push({name: name, deb: pkg[name].deb});
                    }
                    else if(typeof(pkg) == 'string'){
                        this.packages.default.push(pkg);
                    }

                });
            }
        }

        let packagesObj =   {
                                'packages':
                                    {
                                        'default': this.packages.default.map(p => {return {'name': p}}),
                                        'deb': this.packages.deb,
                                        'ppa': this.packages.ppa.map(p => {return {'name': p}})
                                    }
                            };

        // console.log('default', packagesObj.packages.default);
        // console.log('deb', packagesObj.packages.deb);
        // console.log('ppa', packagesObj.packages.ppa);
        // console.log('packagesobj', packagesObj);

        let playbookTemplate = path.resolve(
            this.remotesPath,
            `bakelets-source/packages/apt.yml.mustache`
        );
        let playbookRendered = mustache.render(await fs.readFile(playbookTemplate, 'utf8'), packagesObj);

        // console.log('playbookrendered', playbookRendered);
        let cmd = `echo "${playbookRendered.replace(/"/g, '\\"')}" > /home/vagrant/baker/${this.name}/apt.yml`;
        await this.exec(cmd);
    }

    async install() {
        var cmd = `apt.yml`;
        await Ansible.runAnsiblePlaybook(
            { name: this.name },
            cmd,
            this.ansibleSSHConfig,
            this.verbose,
            this.variables
        );
    }
}

module.exports = Apt;
