const Promise         = require('bluebird');
const child_process   = Promise.promisifyAll(require('child_process'));
const conf            = require('../configstore');
const Docker          = require('dockerode');
const fs              = require('fs-extra');
const jsonfile        = require('jsonfile')
const path            = require('path');
const print           = require('../print');
const Provider        = require('./provider');
const Servers         = require('../servers');
const slash           = require('slash');
const spinner         = require('../spinner');
const spinnerDot      = conf.get('spinnerDot');
const Ssh             = require('../ssh');
const stream          = require('stream');
const Utils           = require('../utils/utils');
const vagrant         = Promise.promisifyAll(require('node-vagrant'));
const VagrantProvider = require('./vagrant');
const yaml            = require('js-yaml');

const { environmentIndexPath, ansible, bakeletsPath, remotesPath, boxes } = require('../../../global-vars');

class Docker_Provider extends Provider {
    constructor(dockerHost) {
        super();
        this.vagrantProvider = new VagrantProvider();
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

    async images() {
        console.log(await this.docker.listImages());
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
    async init (image, cmds, name, ip, volume, ports) {

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
            ExposedPorts: {},
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
        ports.forEach(port => {
            options.ExposedPorts[`${port}/tcp`] = {}
        })

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
    async _deleteContainer(container) {
        return await container.remove({force: true});
    }

    /**
     * removs a container by name
     * @param {String} containerName name of container to be removed
     */
    async delete(containerName) {
        let container = await this.getContainerByName(containerName);
        if(container){
            await this._deleteContainer(container);
            Utils.removeFromIndex(containerName);
        }
        else
            throw `container doesn't exist: ${containerName}`;
    }

    /**
     * stops all the containers on the host
     */
    async stopall() {
        let containers = await this.docker.listContainers();
        containers.forEach((containerInfo) => {
            this.docker.getContainer(containerInfo.Id).stop();
        });
    }

    /**
     * ssh to docker container
     */
    async ssh(name) {
        try {
            const dockerHostName = 'docker-srv';
            const dockerHostPath = path.join(boxes, dockerHostName);
            let machine = vagrant.create({
                cwd: dockerHostPath
            });
            let privateKeyPath = (await this.vagrantProvider.getSSHConfig(machine)).private_key;

            try {
                child_process.execSync(`ssh -tt -i ${privateKeyPath} -o IdentitiesOnly=yes vagrant@192.168.252.251 docker exec -it ${name} /bin/bash`, {
                    stdio: ['inherit', 'inherit', 'inherit']
                });
            } catch (err) {
                // throw `VM must be running to open SSH connection. Run \`baker status\` to check status of your VMs.`
            }
        } catch (err) {
            throw err;
        }
    }

    async list() {
        console.log(await this.info());
    }

    async runDockerBootstrap(sshConfig, containerName) {
        return Ssh.sshExec(`cd /home/vagrant/baker/ && ansible-playbook -i ./${containerName}/baker_inventory dockerBootstrap.yml`, sshConfig, true);
    }

    async _startContainer(scriptPath) {
        // Make sure Baker control machine is running
        let ansibleVM = await spinner.spinPromise(Servers.prepareAnsibleServer(scriptPath), 'Preparing Baker control machine', spinnerDot);
        let ansibleSSHConfig = await this.vagrantProvider.getSSHConfig(ansibleVM);
        // Make sure Docker VM is running
        await spinner.spinPromise(Servers.prepareDockerVM(), `Preparing Docker host`, spinnerDot);

        // Installing Docker
        // let resolveB = require('../bakelets/resolve');
        // await resolveB.resolveBakelet(bakeletsPath, remotesPath, doc, scriptPath, verbose)

        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));

        let image;
        if(doc.container)
            image = doc.container.image || 'ubuntu:latest'
        else {
            print.error('To use Docker commands, you need to add `container` specifiction in your baker.yml');
            process.exit(1);
        }

        await this.pull(image);

        // Check if a contaienr with this name exists and do something based on its state
        // let existingContainers = await dockerProvider.info();
        // let sameNameContainer = existingContainers.filter(c => c.name == doc.name)[0];
        // if (sameNameContainer && sameNameContainer.state == 'stopped') {
        // }
        try {
            let sameNameContainer = await this.info(doc.name);
            if(sameNameContainer.state == 'stopped')
                await this.delete(doc.name);
            else
                throw  `the container name ${doc.name} is already in use by another running container.`

        } catch (error) {
            if(error != `container doesn't exist: ${doc.name}`)
                throw error;
        }

        let exposedPorts = [];
        if( doc.container.ports ) {
            // ports: '8000, 9000,  1000:3000'
            let ports = doc.container.ports.toString().trim().split(/\s*,\s*/g);
            for( var port of ports  ) {
                let p = port.trim().split(/\s*:\s*/g);
                let guest = p[0];
                // ignoring host port for now. only exposing the guest port
                // let host  = a[1] || a[0];
                exposedPorts.push(guest);
            }
        }

        let container = await this.init(image, [], doc.name, doc.container.ip, scriptPath, exposedPorts);
        await this.startContainer(container);

        // TODO: root is hard coded
        await this.addToAnsibleHostsDocker(doc.name, ansibleSSHConfig, 'root')

        // prompt for passwords
        if( doc.vars ) {
            await Utils.traverse(doc.vars);
        }

        // let vmSSHConfig = await this.getSSHConfig(machine);
    }

    async bake(scriptPath) {
        // Start the container
        await this._startContainer(scriptPath);

        let ansibleVM = vagrant.create({ cwd: ansible });
        let ansibleSSHConfig = await this.vagrantProvider.getSSHConfig(ansibleVM);

        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));

        // run dockerBootstrap.yml
        // TODO:
        await this.runDockerBootstrap(ansibleSSHConfig, doc.name);

        // Installing stuff
        let resolveB = require('../../bakelets/resolve');
        await resolveB.resolveBakelet(bakeletsPath, remotesPath, doc, scriptPath, true);

        Utils.addToIndex(doc.name, scriptPath, 'container', await this.info(doc.name));
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
            hostname: inspect.NetworkSettings.Networks.shared_nw.IPAddress,
            user: inspect.Config.User === '' ? 'root' : inspect.Config.User,
            state: inspect.State.Running ? 'running' : 'stopped',
            image: inspect.Config.Image
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

    // TODO: could be private?
    /**
     * Adds the host url to /etc/hosts
     *
     * @param {String} ip
     * @param {String} name
     * @param {Object} sshConfig
     */
    async addToAnsibleHostsDocker (name, ansibleSSHConfig, user){
        // TODO: Consider also specifying ansible_connection=${} to support containers etc.
        // TODO: Callers of this can be refactored to into two methods, below:
        // return Ssh.sshExec(`mkdir -p /home/vagrant/baker/${name}/ && echo "${name}\tansible_connection=docker\tansible_user=${user}" > /home/vagrant/baker/${name}/baker_inventory && ansible all -i /home/vagrant/baker/${name}/baker_inventory -m lineinfile -a 'dest=/etc/environments line="DOCKER_HOST=tcp://192.168.252.251:2375"'`, ansibleSSHConfig);
        return Ssh.sshExec(`mkdir -p /home/vagrant/baker/${name}/ && echo "${name}\tansible_connection=docker\tansible_user=${user}" > /home/vagrant/baker/${name}/baker_inventory && ansible all  -i "localhost," -m lineinfile -a 'dest=/etc/environment line="DOCKER_HOST=tcp://192.168.252.251:2375"' -c local --become`, ansibleSSHConfig);
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
