// Can handle java8 by looking up

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
        console.log("load", "java", this.version);
        console.log("Copying files to baker VM");

        let playbook = path.resolve(`remotes/bakerlets-source/lang/java/java${this.version}.yml`);
        await this.copy(playbook,`/home/vagrant/baker/${this.name}/java${this.version}.yml`);
        
    }

}

module.exports = Java;