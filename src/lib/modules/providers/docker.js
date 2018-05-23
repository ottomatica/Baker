const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const _ = require('lodash');
const stream        = require('stream');
const Docker = require('dockerode');
const homedir       = require('os').homedir;
const slash = require('slash');

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
     * @param {string} image image name and tag
     * @param {string[]} cmds list of commands [optional]
     * @param {string} name name of the container [optional]
     * @param {string} volume source path to be mounted (will be mounted @ /{base_name})
     * @returns container
     */
    async init (image, cmds, name, ip, volume) {

        let source = slash(path.join(`/home/vagrant/host_root`, volume.split(":").pop()));
        let dest = `/${path.basename(volume)}`

        // console.log(`\n\n\n\n${homedir()}:${source}:${dest}\n\n\n\n`)

        let options = {
            Image: image,
            AttachStdin: false,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
            Cmd: cmds || undefined,
            name: name || undefined,
            OpenStdin: false,
            StdinOnce: false,
            Volumes: {},
            Binds: [`${source}:${dest}`],
            NetworkingConfig: {
                EndpointsConfig: {
                    shared_nw: {
                        IPAMConfig: {
                            IPv4Address: ip || undefined
                        }
                    }
                }
            }
        };

        return await this.docker.createContainer(options);
    }

    /**
     * starts a container
     * @param {Container} container container to be started
     */
    async startContainer (container) {
        return await container.start();
    }

    /**
     * starts a container by name
     * @param {String} containerName name of container to be stopped
     */
    async start (containerName) {
        let container = await this.getContainerByName(containerName);
        if(container)
            return await this.startContainer(container);
        else
            throw `container doesn't exist: ${containerName}`;
    }

    /**
     * private: stops a container
     * @param {Container} container container to be stopped
     */
    async _stopContainer (container) {
        return await container.stop();
    }

    /**
     * stops a container by name
     * @param {String} containerName name of container to be stopped
     */
    async stop (containerName) {
        let container = await this.getContainerByName(containerName);
        if(container)
            return await this._stopContainer(container);
        else
            throw `container doesn't exist: ${containerName}`;
    }

    /**
     * private: removes a container
     * @param {Container} container container to be removed
     */
    async _removeContainer (container) {
        return await container.remove({force: true});
    }

    /**
     * removs a container by name
     * @param {String} containerName name of container to be removed
     */
    async remove (containerName) {
        let container = await this.getContainerByName(containerName);
        if(container)
            return await this._removeContainer(container);
        else
            throw `container doesn't exist: ${containerName}`;
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
     * @param {String} containerName name of the container
     * @returns {Container} container object with the given name, or undefined if it doesn't exist
     */
    async getContainerByName(containerName) {
        let existingContainers = await this.info();
        let sameNameContainer = existingContainers.filter(c => c.name == containerName)[0];
        if(sameNameContainer)
            return this.docker.getContainer(sameNameContainer.id);
        else
            return undefined;
    }

    /**
     * Helper function to get info for all containers
     * Note: This should not be called directly, instead call this.info()
     */
    async _getOveralInfo () {
        let self = this;
        let containers = await this.docker.listContainers({all: true});
        let info = [];
        for (let i = 0; i < containers.length; i++) {
            let containerInfo = await self._getContainerInfo(await self.getContainer(containers[i].Id));
            containerInfo.name = containers[i].Names[0].replace('/', ''); //?
            info.push(containerInfo);
        }
        return info;
    }

    /**
     * Helper function to get info for a specific container.
     * Note: This should not be called directly, instead call this.info()
     * @param {Docker.Container} container
     */
    async _getContainerInfo (container) {
        let inspect = await container.inspect();
        return {
            id: inspect.Id,
            host: inspect.Config.Hostname,
            hostname: inspect.NetworkSettings.IPAddress,
            user: inspect.Config.User,
            state: inspect.State.Running ? 'running' : 'stopped'
        }
    }

    /**
     *
     * @param {String} containerName
     */
    async info(containerName=undefined) {
        if(containerName){
            let container = await this.getContainerByName(containerName);
            if(container){
                let containerInfo = await this._getContainerInfo(container);
                containerInfo.name = containerName; // TODO: can we get the name from inspect?
                return containerInfo;
            }
            else
                throw `container doesn't exist: ${containerName}`;
        }
        else
            return this._getOveralInfo();
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
