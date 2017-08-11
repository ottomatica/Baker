'use strict';

module.exports = function(dep) {
    // const { path, scp2, fs, Client, print, ssh } = dep;
    let result = {};

    result.copyFilesForAnsibleServer = async function(
        bakerScriptPath,
        doc,
        ansibleSSHConfig
    ) {
        const { path, ssh, configPath } = dep;

        return new Promise(async (resolve, reject) => {
            if (doc.bake && doc.bake.ansible && doc.bake.ansible.source) {
                // Copying ansible script to ansible vm
                if (bakerScriptPath != undefined) {
                    await ssh.copyFromHostToVM(
                        path.resolve(bakerScriptPath, doc.bake.ansible.source),
                        `/home/vagrant/baker/${doc.name}`,
                        ansibleSSHConfig,
                        false
                    );
                }
            }

            // Copy common ansible scripts files
            await ssh.copyFromHostToVM(
                path.resolve(configPath, './common/registerhost.yml'),
                `/home/vagrant/baker/registerhost.yml`,
                ansibleSSHConfig,
                false
            );

            await ssh.copyFromHostToVM(
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

    result.copyFromHostToVM = async function(src, dest, destSSHConfig, chmod_=true) {
        const { scp2, fs, print, ssh } = dep;

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
                            await ssh.chmod(dest, destSSHConfig)
                        }
                        resolve();
                    }
                }
            );
        });
    }

    result.sshExec = async function(cmd, sshConfig) {
        const { Client, fs } = dep;

        return new Promise((resolve, reject) => {
            var c = new Client();
            c
                .on('ready', function() {
                    c.exec(cmd, function(err, stream) {
                        if (err) throw err;
                        stream
                            .on('close', function(code, signal) {
                                c.end();
                                resolve();
                            })
                            .on('data', function(data) {
                                console.log('STDOUT: ' + data);
                            })
                            .stderr.on('data', function(data) {
                                console.log('STDERR: ' + data);
                                reject();
                            });
                    });
                })
                .connect({
                    host: '127.0.0.1',
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
    result.chmod = async function(key, sshConfig) {
        const { ssh } = dep;

        // && eval "$(ssh-agent -s)" && ssh-add ${key}
        return ssh.sshExec(`chmod 600 ${key}`, sshConfig);
    }

    return result;
};
