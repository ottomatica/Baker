const { commands, modules } = require('../../../baker');
const baker = modules['baker'];

const Bakelet = require('../bakelet');
const path = require('path');

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
        await baker.runAnsibleAptInstall(
            {name: this.name}, "maven", this.ansibleSSHConfig, this.verbose
        );
    }

}

module.exports = Maven;
