const Bakelet = require('../bakelet');
const Baker   = require('../../modules/baker');
const path    = require('path');

class Maven extends Bakelet {

    constructor(name,ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;

    }

    async load()
    {
    }

    async install()
    {
        await Baker.runAnsibleAptInstall(
            {name: this.name}, "maven", this.ansibleSSHConfig, this.verbose
        );
    }

}

module.exports = Maven;
