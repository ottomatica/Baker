const Bakelet = require('../bakelet');
const Ansible = require('../../modules/configuration/ansible');

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
        await Ansible.runAnsibleAptInstall(
            {name: this.name}, "maven", this.ansibleSSHConfig, this.verbose
        );
    }

}

module.exports = Maven;
