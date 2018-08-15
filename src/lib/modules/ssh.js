const { promisify }  = require('util');
let child_process    = require('child_process');
const execAsync      = promisify(child_process.exec);
const { configPath } = require('../../global-vars');
const Client         = require('ssh2').Client;
const fs             = require('fs')
const path           = require('path');
const print          = require('./print')
const scp2           = require('scp2');

class Ssh {
    constructor() {}


    static nativeSSH_Session(sshConfig, cmd)
    {
        cmd = cmd ? `'${cmd}'` : '';
        child_process.execSync(`ssh -q -i "${sshConfig.private_key}" -p "${sshConfig.port}" -o StrictHostKeyChecking=no "${sshConfig.user}"@"${sshConfig.hostname}" -tt ${cmd}`, {stdio: ['inherit', 'inherit', 'inherit']});
    }

    static async copyFilesForAnsibleServer(bakerScriptPath, doc, ansibleSSHConfig) {
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

    static async copyFromHostToVM(src, dest, destSSHConfig, chmod_ = true) {
        let Ssh = this;

        if( !fs.existsSync(src) )
        {
            throw new Error(`Path cannot be found on your machine: ${src}`);
        }

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
                async function (err) {
                    if (err) {
                        print.error(`Failed to configure ssh keys: ${err}`);
                        reject();
                    } else {
                        if (chmod_) {
                            await Ssh.chmod(dest, destSSHConfig)
                        }
                        resolve();
                    }
                }
            );
        });
    }

    static async SSH_Session(sshConfig, cmd, timeout=20000){
        try {
            await this.nativeSSH_Session(sshConfig, cmd);
        } catch (err) {
            try {
                await this.jsSSH_Session(sshConfig, cmd, timeout);
            } catch (err) {
                console.error(err);
            }
        }
    }

    static async jsSSH_Session(sshConfig, cmd, timeout=20000, options={}) {
        return new Promise((resolve, reject) => {
            var conn = new Client();
            conn.on('ready', function () {
                let clearedTermGarabge = false;
                conn.shell(function (err, stream)
                {
                    if (err) throw err;
                    stream.on('close', function() {
                        console.log('Exiting...');
                        conn.end();
                    }).on('data', function(data) {
                        if( !clearedTermGarabge && data == ';' ) {
                            // Some process is sending this output which makes its way into bash input prompt
                            // "^[[15;43R^[[15;51R";
                            // This seems related to terminal info codes (size of columns, etc.)
                            // https://invisible-island.net/ncurses/terminfo.src.html
                            // \x15 sends Ctrl-U which will clear the line of any input.
                            stream.stdin.write('\x15');
                            // We only need to do this once.
                            clearedTermGarabge = true;
                        }
                    }).stderr.on('data', function(data) {
                        console.log('STDERR: ' + data);
                    });

                    if(cmd) stream.stdin.write(cmd);

                    // Redirect input/from our process into stream;
                    process.stdin.setRawMode(true);
                    process.stdin.pipe(stream);

                    // Pipe stdout/stderr into our process
                    stream.pipe(process.stdout);
                    stream.stderr.pipe(process.stderr);
                    stream.setWindow(process.stdout.rows, process.stdout.columns);

                    process.stdout.on('resize', () => {
                        stream.setWindow(process.stdout.rows, process.stdout.columns);
                    });

                    // Retrieve keypress listeners
                    // const listeners = process.stdin.listeners('keypress');
                    // Remove those listeners
                    //process.stdin.removeAllListeners('keypress');

                    stream.on('close', () => {
                        // Release stdin
                        process.stdin.setRawMode(false);
                        process.stdin.unpipe(stream);
                        if (!options.preserveStdin) {
                            process.stdin.unref();
                        }
                        // Restore listeners
                        //listeners.forEach(listener => process.stdin.addListener('keypress', listener));
                        // End connection
                        conn.end();
                        resolve();
                    });
                });
            }).on('error', function(err)
            {
                reject(err);
            })
            .connect({
                host: sshConfig.hostname,
                port: sshConfig.port,
                username: sshConfig.user,
                privateKey: fs.readFileSync(sshConfig.private_key),
                readyTimeout: timeout
            });
        });
    }

    static async sshExecBackground(cmd, sshConfig, verbose)
    {
        return new Promise((resolve, reject) =>
        {
            const client = new Client();
            client.on("ready", () => {
                client.exec(cmd, function (err, stream){
                    console.log(`Issued ${cmd}`);
                    stream.on('close', function (code, signal)
                    {
                        setTimeout(function(){
                            client.end();
                            resolve(code);
                        }, 500);
                    })
                    .on('data', function (data) {
                    })
                    .stderr.on('data', function(data)
                    {
                        reject(data);
                    });
                });
            }).connect({
                host: sshConfig.hostname,
                port: sshConfig.port,
                username: sshConfig.user,
                privateKey: fs.readFileSync(sshConfig.private_key),
            });
        });
    }

    static async sshExec(cmd, sshConfig, timeout=20000, verbose=false, options={}) {
        try {
            return await this._nativeSSHExec(cmd, sshConfig, timeout=20000, verbose=false, options={});
        } catch (err) {
            try {
                return await this._JSSSHExec(cmd, sshConfig, timeout=20000, verbose=false, options={});
            } catch (err) {
                console.error(err);
            }
        }
    }

    static async _JSSSHExec(cmd, sshConfig, timeout=20000, verbose=false, options={}) {
        let buffer = "";
        return new Promise((resolve, reject) => {
            var c = new Client();
            c
                .on('ready', function () {
                    c.exec(cmd, options, function (err, stream) {
                        if (err) {
                            console.error(err);
                            reject(err);
                        }
                        stream
                            .on('close', function (code, signal) {
                                c.end();
                                // console.log(code, signal);
                                resolve(buffer);
                            })
                            .on('data', function (data) {
                                if (verbose) {
                                    console.log('STDOUT: ' + data);
                                }
                                buffer += data;
                            })
                            .stderr.on('data', function (data) {
                                console.log('STDERR: ' + data);
                                reject(data);
                            });
                    });
                }).on('error', function(err)
                {
                    if( err.message.indexOf('ECONNREFUSED') > 0 )
                    {
                        // Give vm 5 more seconds to get ready
                        console.log(`Waiting 5 seconds for ${sshConfig.hostname}:${sshConfig.port} to be ready`);
                        setTimeout(async function()
                        {
                            resolve( await Ssh.sshExec(cmd, sshConfig, timeout, verbose, options) );
                        }, 5000);
                    }
                    else
                    {
                        reject(err);
                    }
                })
                .connect({
                    host: sshConfig.hostname,
                    port: sshConfig.port,
                    username: sshConfig.user,
                    privateKey: fs.readFileSync(sshConfig.private_key),
                    readyTimeout: timeout
                });
        });
    }

    static async _nativeSSHExec(cmd, sshConfig, timeout = 20000, verbose = false, options = {}) {
        let output = verbose ? 'inherit' : 'ignore';

        let prepareSSHCommand = `ssh -q -i "${sshConfig.private_key}" -p "${sshConfig.port}" -o StrictHostKeyChecking=no -o ConnectTimeout=${Math.floor(timeout/1000)} -o 'ConnectionAttempts 60' "${sshConfig.user}"@"${sshConfig.hostname}" '${cmd}'`;
        // TODO: how can we ensure this failure is because server is not up yet?
        // prepareSSHCommand = `until ${prepareSSHCommand} ; do echo 'Waiting 5 seconds for ${sshConfig.hostname}:${sshConfig.port} to be ready'; sleep 5; done;`
        let output = await execAsync(prepareSSHCommand);
        if(verbose){
            if(output.stdout) console.log(output.stdout);
            if(output.stderr) console.log(output.stderr);
        }
        return output.stdout;
    }

    /**
     * chmod 600 the key files on ansible server,
     * add the key to agent,
     * and add the host url to /etc/hosts
     *
     * @param {String} key path to the key on server
     * @param {Object} sshConfig
     */
    static async chmod(key, sshConfig) {
        // && eval "$(ssh-agent -s)" && ssh-add ${key}
        return this.sshExec(`chmod 600 ${key}`, sshConfig);
    }
}

module.exports = Ssh;
