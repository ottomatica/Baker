const { commands, modules } = require('../../../baker');
const baker = modules['baker'];

const Bakerlet = require('../bakerlet');
const path = require('path');

class Maven extends Bakerlet {

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
        await baker.runAnsibleAptInstall(
            {name: this.name}, "maven", this.ansibleSSHConfig, this.vmSSHConfig, this.verbose
        );
    }

}

module.exports = Maven;
