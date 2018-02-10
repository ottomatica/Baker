const { commands, modules } = require('../../../baker');
const baker = modules['baker'];

const Bakerlet = require('../bakerlet');
const path = require('path');
const fs   = require('fs');

class Python extends Bakerlet {

    constructor(name, ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        // Default to python2
        this.version = version || 2;
    }

    async load(obj, variables)
    {
        let playbook = path.resolve(this.remotesPath, `bakerlets-source/lang/python/python${this.version}.yml`);
        await this.copy(playbook, `/home/vagrant/baker/${this.name}/python${this.version}.yml`);
        this.variables = variables;
    }

    async install()
    {
        var cmd = `python${this.version}.yml`;
        await baker.runAnsiblePlaybook(
            {name: this.name}, cmd, this.ansibleSSHConfig, this.vmSSHConfig, this.verbose, this.variables
        );

        // Check for a requirements.txt and then run pip install -r requirements.txt
        // TODO: Possible to allow a requirements: parameter in the python object.
        // Otherwise, we might just want it in the packages: pip: requirements: path
        var localRequirementsPath = path.resolve(this.bakePath, "requirements.txt");
        if( fs.existsSync(localRequirementsPath) )
        {
            var vmRequirementsPath = `/${path.basename(this.bakePath)}/requirements.txt`;
            await baker.runAnsiblePipInstall(
                {name: this.name}, vmRequirementsPath, this.ansibleSSHConfig, this.verbose
            );
        }
    }


}

module.exports = Python;
