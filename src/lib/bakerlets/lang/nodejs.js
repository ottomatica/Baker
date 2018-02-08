const { commands, modules } = require('../../../baker');
const baker = modules['baker'];

const Bakerlet = require('../bakerlet');
const path = require('path');
const fs   = require('fs');

class Nodejs extends Bakerlet {

    constructor(name, ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;

    }

    async load(obj, variables)
    {
        //console.log("load", "java", this.version);
        //console.log("Copying files to baker VM");
        let playbook = path.resolve(this.remotesPath, `bakerlets-source/lang/nodejs/nodejs${this.version}.yml`);
        await this.copy(playbook, `/home/vagrant/baker/${this.name}/nodejs${this.version}.yml`);
        this.variables = variables;
    }

    async install()
    {
        var cmd = `nodejs${this.version}.yml`;
        await baker.runAnsiblePlaybook(
            {name: this.name}, cmd, this.ansibleSSHConfig, this.verbose, this.variables
        );

        var localPackageJsonPath = path.resolve(this.bakePath, "package.json");
        if( fs.existsSync(localPackageJsonPath) )
        {
            // There could be some funkyness depending on if there is a package-lock.json, etc:
            // and node_modules is manually deleted:
            // https://github.com/ansible/ansible/pull/29131
            var vmPackagePath = `/${path.basename(this.bakePath)}`;
            if( this.verbose ) console.log(`Attempting to run npm install in vm at ${vmPackagePath}`);
            await baker.runAnsibleNpmInstall(
                {name: this.name}, vmPackagePath, this.ansibleSSHConfig, this.verbose
            );
        }

    }


}

module.exports = Nodejs;
