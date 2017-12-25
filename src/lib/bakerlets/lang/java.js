// Can handle java8 by looking up

const Bakerlet = require('../bakerlet');

class Java extends Bakerlet {
    
    constructor(name,configPath,ansibleSSHConfig, bakerletsPath, version) {
        this.name = name;
        this.bakerletsPath = bakerletsPath;
        this.version = version;

        super(configPath,ansibleSSHConfig)
    }

    load()
    {
        console.log("load", this.bakerletsPath, this.version);
        console.log("Copying files to baker VM");

        let playbook = path.resolve(`remotes/baker-lets-source/lang/java/java${this.version}.yml`);
        this.copy(playbook,`/home/vagrant/baker/${this.name}/java${this.version}.yml`)
        
    }

}

module.exports = Java;