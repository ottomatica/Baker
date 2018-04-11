const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const _ = require('lodash');
const stream        = require('stream');
const Docker = require('dockerode');

class Docker_Provider {
    constructor(dockerHost) {
        // https://stackoverflow.com/questions/26561963/how-to-detect-a-docker-daemon-port

        //this.docker = new Docker({socketPath: '/var/run/docker.sock'});
        // {host: '192.168.0.10', port: '2375', protocol: 'http'}
        this.docker = new Docker(dockerHost);
    }

    async removeContainers()
    {
        let self = this;
        return new Promise( async function (resolve, reject)
        {
            let containers = await self.docker.listContainers({all: true});
            for( let containerInfo of containers )
            {
                if( containerInfo.State === 'running' )
                {
                    await self.docker.getContainer(containerInfo.Id).stop();
                }
                await self.docker.getContainer(containerInfo.Id).remove();
                //console.log( containerInfo );
            };
            resolve()
        });
    }

    async pull(imageName)
    {
        let self = this;
        //console.log( `pulling ${imageName}`);
        process.stdout.write(`pulling ${imageName} `);
        return new Promise((resolve, reject) => {
            self.docker.pull(imageName, (error, stream) => {
                self.docker.modem.followProgress(stream, (error, output) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    process.stdout.write(`... pulled\n`);
                    resolve(output);
                }, (event) => console.log(event));
            });
        })
    }

    async getContainerIp(name) {
        var container = this.docker.getContainer(name);
        let data = await container.inspect();
        return data.NetworkSettings.IPAddress;
    }

    async run(image, cmd, name)
    {
        await this.docker.createContainer({
            name: name,
            Image: image,
            AttachStdin: false,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
            Cmd: Array.isArray(cmd) ? cmd: [cmd],
            OpenStdin: false,
            StdinOnce: false,
        }).then(function(container) {
            return container.start();
        });
    }

    /**
     * initialize container
     *
     * @param {image} image image name and tag
     * @param {cmds} cmds list of commands [optional]
     * @param {name} name name of the container [optional]
     * @returns container
     */
    async init (image, cmds, name, ip) {
        // promises are supported
        return await this.docker.createContainer({
            Image: image,
            AttachStdin: false,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
            Cmd: cmds || undefined,
            name: name || undefined,
            OpenStdin: false,
            StdinOnce: false,
            NetworkingConfig: {
                EndpointsConfig: {
                    shared_nw: {
                        IPAMConfig: {
                            IPv4Address: ip || undefined
                        }
                    }
                }
            }
        });
    }

    /**
     * starts a container
     * @param {Container} container container to be started
     */
    async start (container) {
        return await container.start();
    }

    /**
     * stops a container
     * @param {Container} container container to be stopped
     */
    async stop (container) {
        return await container.stop();
    }

    /**
     * removes a container
     * @param {Container} container container to be removed
     */
    async remove (container) {
        return await container.remove();
    }

    /**
     * stops all the containers on the host
     */
    async stopall(){
        let containers = await this.docker.listContainers();
        containers.forEach((containerInfo) => {
            this.docker.getContainer(containerInfo.Id).stop();
        });
    }

    /**
     * Helper function to get info for all containers
     * Note: This should not be called directly, instead call this.info()
     */
    async _overalInfo () {
        let self = this;
        let containers = await this.docker.listContainers();
        let info = [];
        containers.forEach(async function (containerInfo) {
            info.push(await self._containerInfo(await self.getContainer(containerInfo.Id)));
            // console.log(await this._containerInfo(await this.getContainer(containerInfo.Id)))
        })
        return info;
    }

    /**
     * Helper function to get info for a specific container.
     * Note: This should not be called directly, instead call this.info()
     * @param {Docker.Container} container
     */
    async _containerInfo (container) {
        let inspect = await container.inspect();
        return {
            host: inspect.Config.Hostname,
            hostname: inspect.NetworkSettings.IPAddress,
            user: inspect.Config.User
        }
    }

    /**
     *
     * @param {Docker.Container} container
     */
    async info(container=undefined) {
        if(container)
            return this._containerInfo(container);
        else
            return this._overalInfo();
    }

    /**
     * Gets the container object by name or id
     * @param {String} nameOrId
     */
    async getContainer(nameOrId) {
        return this.docker.getContainer(nameOrId);
    }

    async exec(name, cmd)
    {
        let self = this;
        return new Promise(function(resolve,reject)
        {
            var options = {
                Cmd: ['bash', '-c', cmd],
                //Cmd: ['bash', '-c', 'echo test $VAR'],
                //Env: ['VAR=ttslkfjsdalkfj'],
                AttachStdout: true,
                AttachStderr: true
            };
            var container = self.docker.getContainer(name);
            var logStream = new stream.PassThrough();

            var output = "";
            logStream.on('data', function(chunk){
            //console.log(chunk.toString('utf8'));
                output += chunk.toString('utf8');
            });

            container.exec(options, function(err, exec) {
                if (err) return;
                exec.start(function(err, stream) {
                    if (err) return;

                    container.modem.demuxStream(stream, logStream, logStream);
                    stream.on('end', function(){
                        logStream.destroy();
                        resolve(output);
                    });

                    // exec.inspect(function(err, data) {
                    //     if (err) return;
                    //     console.log(data);
                    // });
                });
            });
        });
    }

}

module.exports = Docker_Provider;

let foo = async function ()
{
    let dockerProvider = new Docker_Provider({host: '192.168.252.251', port: '2375', protocol: 'http'});
    // await dockerProvider.pull('python:2-alpine');
    // await dockerProvider.removeContainers();

    // let container = await dockerProvider.init('python:2-alpine', []);
    // console.log(container);
    // await dockerProvider.start(container);
    // console.log(await container.inspect())
    // console.log(await dockerProvider.info(container))

    // console.log(await dockerProvider.getContainer('eager_brattain'))
    // await dockerProvider.stop(await dockerProvider.getContainer('6f77e16b2551'));

    // await dockerProvider.stopall()

    // console.log(await dockerProvider.info(await dockerProvider.getContainer('97f5f03c47b7')));
    console.log(await dockerProvider.info());


};


// foo();
