const Bakelet = require('../bakelet');
const Ansible = require('../../modules/configuration/ansible');
const fs      = require('fs-extra');
const path    = require('path');

class Python extends Bakelet {

    constructor(name, ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        // Default to python2
        this.version = version || 2;
    }

    async load(obj, variables)
    {
        let playbook = path.resolve(this.remotesPath, `bakelets-source/lang/python/python${this.version}.yml`);
        await this.copy(playbook, `/home/vagrant/baker/${this.name}/python${this.version}.yml`);
        this.variables = variables;
    }

    async install()
    {
        var cmd = `python${this.version}.yml`;
        await Ansible.runAnsiblePlaybook(
            {name: this.name}, cmd, this.ansibleSSHConfig, this.verbose, this.variables
        );

        // Check for a requirements.txt and then run pip install -r requirements.txt
        // TODO: Possible to allow a requirements: parameter in the python object.
        // Otherwise, we might just want it in the packages: pip: requirements: path
        // var localRequirementsPath = path.resolve(this.bakePath, "requirements.txt");
        // if( fs.existsSync(localRequirementsPath) )
        // {
        //     var vmRequirementsPath = `/${path.basename(this.bakePath)}/requirements.txt`;
        //     await Ansible.runAnsiblePipInstall(
        //         {name: this.name}, vmRequirementsPath, this.ansibleSSHConfig, this.verbose
        //     );
        // }
    }


}

module.exports = Python;
