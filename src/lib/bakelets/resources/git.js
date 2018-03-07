const Bakelet  = require('../bakelet');
const Baker    = require('../../modules/baker');

class Git extends Bakelet {
    constructor(name, ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;
    }

    async load(obj, variables) {
        this.variables = variables;

        if (obj.git) {
            let type = typeof(obj.git);
            if (type == 'string'){
                let git = obj.git.trim();
                this.dest = git.split(/\s*:\s*/).pop();
                this.repo = git.substring(0, git.length-this.dest.length-1);
            }
            else if(type == 'object'){
                this.repo = obj.git.repo;
                this.dest = obj.git.dest;
            }
        }

        console.log('repo', this.repo);
        console.log('dest', this.dest);
    }

    async install() {
        await Baker.runGitClone({name: this.name}, this.repo, this.dest, this.ansibleSSHConfig, this.verbose);
    }
}

module.exports = Git;
