const { commands, modules } = require('../../../baker');
const baker = modules['baker'];

const Bakerlet = require('../bakerlet');
const path = require('path');

class Java extends Bakerlet {
    
    constructor(name,ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;

    }

    async load()
    {
        //console.log("load", "java", this.version);
        //console.log("Copying files to baker VM");
        let playbook = path.resolve(this.remotesPath, `bakerlets-source/lang/java/java${this.version}.yml`);
        await this.copy(playbook,`/home/vagrant/baker/${this.name}/java${this.version}.yml`);
        
    }

    async install()
    {
        var cmd = `java${this.version}.yml`;
        await baker.runAnsiblePlaybook(
            {name: this.name}, cmd, this.ansibleSSHConfig
        );
        //console.log(`installed java ${this.version}`);
    }


}

module.exports = Java;