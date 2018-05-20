const { configPath } = require('../../global-vars');
const Client         = require('ssh2').Client;
const fs             = require('fs')
const path           = require('path');
const print          = require('./print')
const scp2           = require('scp2');

class Ssh {
    constructor() { }

    static async copyFilesForAnsibleServer (
        bakerScriptPath,
        doc,
        ansibleSSHConfig
    ) {
        return new Promise(async (resolve, reject) => {
            if (doc.bake && doc.bake.ansible && doc.bake.ansible.source) {
                // Copying ansible script to ansible vm
                if (bakerScriptPath != undefined) {
                    await this.copyFromHostToVM(
                        path.resolve(bakerScriptPath, doc.bake.ansible.source),
                        `/home/vagrant/baker/${doc.name}`,
                        ansibleSSHConfig,
                        false
                    );
                }
            }

            // TODO: Temp: refactor to be able to use the bakelet instead
            await this.copyFromHostToVM(
                path.resolve(configPath, './common/installDocker.yml'),
                `/home/vagrant/baker/installDocker.yml`,
                ansibleSSHConfig,
                false
            );

            await this.copyFromHostToVM(
                path.resolve(configPath, './common/dockerBootstrap.yml'),
                `/home/vagrant/baker/dockerBootstrap.yml`,
                ansibleSSHConfig,
                false
            );

            // Copy common ansible scripts files
            await this.copyFromHostToVM(
                path.resolve(configPath, './common/registerhost.yml'),
                `/home/vagrant/baker/registerhost.yml`,
                ansibleSSHConfig,
                false
            );

            await this.copyFromHostToVM(
                path.resolve(
                    configPath,
                    './common/CheckoutFromVault.yml'
                ),
                `/home/vagrant/baker/CheckoutFromVault.yml`,
                ansibleSSHConfig,
                false
            );

            resolve();
        });
    };

    static async copyFromHostToVM (src, dest, destSSHConfig, chmod_=true) {
        let Ssh = this;
        return new Promise((resolve, reject) => {
            scp2.scp(
                src,
                {
                    host: '127.0.0.1',
                    port: destSSHConfig.port,
                    username: destSSHConfig.user,
                    privateKey: fs.readFileSync(destSSHConfig.private_key, 'utf8'),
                    path: dest
                },
                async function(err) {
                    if (err) {
                        print.error(`Failed to configure ssh keys: ${err}`);
                        reject();
                    }
                    else {
                        if(chmod_) {
                            await Ssh.chmod(dest, destSSHConfig)
                        }
                        resolve();
                    }
                }
            );
        });
    }

    static async sshExec (cmd, sshConfig, verbose) {
        return new Promise((resolve, reject) => {
            var c = new Client();
            c
                .on('ready', function() {
                    c.exec(cmd, function(err, stream) {
                        if (err){
                            print.error(err);
                        }
                        stream
                            .on('close', function(code, signal) {
                                c.end();
                                resolve();
                            })
                            .on('data', function(data) {
                                if( verbose )
                                {
                                    console.log('STDOUT: ' + data);
                                }
                            })
                            .stderr.on('data', function(data) {
                                console.log('STDERR: ' + data);
                                reject();
                            });
                    });
                })
                .connect({
                    host: sshConfig.hostname,
                    port: sshConfig.port,
                    username: sshConfig.user,
                    privateKey: fs.readFileSync(sshConfig.private_key)
                });
        });
    }

    /**
     * chmod 600 the key files on ansible server,
     * add the key to agent,
     * and add the host url to /etc/hosts
     *
     * @param {String} key path to the key on server
     * @param {Object} sshConfig
     */
    static async chmod (key, sshConfig) {
        // && eval "$(ssh-agent -s)" && ssh-add ${key}
        return this.sshExec(`chmod 600 ${key}`, sshConfig);
    }
}

module.exports = Ssh;
