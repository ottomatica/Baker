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
    let dockerProvider = new Docker_Provider({host: '192.168.0.10', port: '2375', protocol: 'http'});
    await dockerProvider.pull('python');
}();

