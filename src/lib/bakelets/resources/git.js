const Bakelet  = require('../bakelet');
const chalk = require('chalk');
const _ = require('underscore');
const Ssh = require('./../modules/ssh');

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
                if( obj.git.private )
                {
                    if( this.variables.filter( x => x.githubuser ).length == 0 || this.variables.filter( x => x.githubpass ).length == 0 )
                    {
                        console.log(chalk.red("You must define a githubuser and githubpass variable in order to clone a private repo"));
                        throw new Error("Cannot complete git operation.");
                    }
                    let user = encodeURIComponent(this.variables.filter( x => x.githubuser )[0].githubuser);
                    let pass = encodeURIComponent(this.variables.filter( x => x.githubpass )[0].githubpass);
                    // gitlab/bitbucket.
                    this.repo = this.repo.replace('github.com', `${user}:${pass}@github.com`);
                }
            }
        }
        if( this.verbose )
        {
            console.log('repo', this.repo);
            console.log('dest', this.dest);
        }
    }

    static async runGitClone (doc, repo, dest, ansibleSSHConfig,verbose) {
        return Ssh.sshExec(`export ANSIBLE_HOST_KEY_CHECKING=false && cd /home/vagrant/baker/${doc.name} && ansible all -m git -a "repo=${repo} dest=${dest} version=HEAD" -i baker_inventory`, ansibleSSHConfig, verbose);
    }

    async install() {
        await runGitClone({name: this.name}, this.repo, this.dest, this.ansibleSSHConfig, this.verbose);
    }
}

module.exports = Git;
