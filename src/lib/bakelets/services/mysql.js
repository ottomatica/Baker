const { commands, modules } = require('../../../baker');
const baker = modules['baker'];
const ssh = modules['ssh'];


const Bakelet = require('../bakelet');
const path = require('path');

class MySql extends Bakelet {

    constructor(name,ansibleSSHConfig, version) {
        super(ansibleSSHConfig);

        this.name = name;
        this.version = version;

    }

    async load(obj, variables)
    {
        this.variables = variables;

        if( obj.mysql )
        {
            if( obj.mysql.version )
            {
                this.version = obj.mysql.version;
            }

            if( obj.mysql.service_conf )
            {
                await ssh.copyFromHostToVM(
                    path.resolve(this.bakePath, obj.mysql.service_conf),
                    `/home/vagrant/baker/${this.name}/templates/`,
                    this.ansibleSSHConfig,
                    false
                );
            }

            if( obj.mysql.client_conf )
            {
                await ssh.copyFromHostToVM(
                    path.resolve(this.bakePath, obj.mysql.client_conf),
                    `/home/vagrant/baker/${this.name}/templates/`,
                    this.ansibleSSHConfig,
                    false
                );
            }

            /// templates/mysql.cfg

        }

        let playbook = path.resolve(this.remotesPath, `bakelets-source/services/mysql/mysql${this.version}.yml`);
        await this.copy(playbook,`/home/vagrant/baker/${this.name}/mysql${this.version}.yml`);
    }

    async install()
    {
        var cmd = `mysql${this.version}.yml`;
        await baker.runAnsiblePlaybook(
            {name: this.name}, cmd, this.ansibleSSHConfig, this.verbose, this.variables
        );
    }
}

module.exports = MySql;
