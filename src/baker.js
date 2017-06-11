/**
 * TODO: reinstall ansible vm is implemented, but doesn't copy know private keys to the new ansible server
 */
const path = require('path');
const fs = require('fs-extra');
const vagrant = require('node-vagrant');
const argv = require('yargs').argv;
const scp2 = require('scp2');
const ssh2 = require('ssh2');
const Client = require('ssh2').Client;
const yaml = require('js-yaml');
const prompt = require('prompt');

var child_process = require('child_process');

var boxes = path.join(require('os').homedir(), '.baker');
var ansible = path.join(boxes, 'ansible-srv');

async function main() {
    if (!fs.existsSync(boxes)) {
        fs.mkdirSync(boxes);
    }
    if (!fs.existsSync(ansible)) {
        fs.mkdirSync(ansible);
    }

    if (argv.install) await installAnsibleServer();
    else if (argv.reinstall) await reinstallAnsibleServer();
    else {
        let ansibleVM = await prepareAnsibleServer();
        let sshConfig = await getSSHConfig(ansibleVM);
        bake('test', sshConfig, ansibleVM);
    }
}

main();

/**
 * get State of a vagrant vm by id.
 * @param {String} id
 */
async function getState(id) {
    return new Promise((resolve, reject) => {
        vagrant.globalStatus(function(err, out) {
            out.forEach(vm => {
                if (vm.id == id) resolve(vm.state);
            });
        });
    });
}

/**
 * get vagrant id of ansible server
 */
async function getAnsibleSrvVagrantId() {
    return new Promise((resolve, reject) => {
        vagrant.globalStatus(function(err, out) {
            out.forEach(vm => {
                if (/ansible-srv/.test(vm.cwd)) {
                    resolve(vm.id);
                }
            });
            resolve(undefined);
        });
    });
}

/**
 * Checks if ansible server is up, if not it starts the server
 * Returns a promise, use cleaner es7 syntax:
 * Resolves the ansible machine
 * ------
 * await prepareAnsibleServer()
 * ...do something after finished preparing server
 * ------
 */
async function prepareAnsibleServer() {
    let machine = vagrant.create({ cwd: ansible });

    // if(await getAnsibleSrvVagrantId() == undefined)
    //     // TODO
    if ((await getState(await getAnsibleSrvVagrantId())) != 'running') {
        console.log('==> Starting ansible server...');
        return new Promise((resolve, reject) => {
            machine.up(function(err, out) {
                // console.log( out );
                console.log(err || '==> Ansible server is now ready!');
                resolve(machine);
            });
        });
    } else {
        console.log('==> Ansible server is now ready!');
        return machine;
    }
}

/**
 * Destroy a vagrant vm sync
 * @param {String} id
 */
function destroyVM(id) {
    console.log('==> Destroying ansible server...');
    child_process.execSync(`vagrant destroy ${id}`, { stdio: 'inherit' });
}

/**
 * Creates ansible server, if already doesn't exist
 */
async function installAnsibleServer() {
    if ((await getAnsibleSrvVagrantId()) != undefined) {
        console.log('==> ansible server already provisioned...');
        prepareAnsibleServer();
        return;
    } else {
        let machine = vagrant.create({ cwd: ansible });
        let config = require('./config/ansible_vm.json');

        fs.copySync(
            path.resolve(__dirname, './config/provision.shell.sh'),
            path.resolve(ansible, 'provision.shell.sh')
        );

        machine.init('ubuntu/trusty64', config, function(err, out) {
            console.log(err || '==> Creating ansible server...');

            // child_process.execSync(`cd ${ansible} && vagrant up`, {stdio: 'inherit'})

            machine.up(function(err, out) {
                // console.log( out );
                if (err) throw `==> Couldn't start ansible server!!`;
                else console.log('==> Ansible server is now ready!');
                return;
            });
            // machine.on("up-progress", function(data)
            // {
            //     console.log(data);
            // })
        });
    }
}

/**
 * Re-installs ansible server.
 * @returns Promise
 */
async function reinstallAnsibleServer() {
    destroyVM(await getAnsibleSrvVagrantId());
    await installAnsibleServer();
}

/**
 * Get ssh configurations
 * @param {Obj} machine
 */
async function getSSHConfig(machine) {
    return new Promise((resolve, reject) => {
        machine.sshConfig(function(err, sshConfig) {
            // console.log( err || "ssh info:" );
            if (sshConfig && sshConfig.length > 0) {
                // callback(sshConfig[0])
                resolve(sshConfig[0]);
            } else {
                // callback(err);
                throw `==> Couldn't get private ssh key of new VM`; // err
            }
        });
    });
}

function copyFromHostToVM(src, dest, destSSHConfig) {
    scp2.scp(
        src,
        {
            host: '127.0.0.1',
            port: destSSHConfig.port,
            username: destSSHConfig.user,
            privateKey: fs.readFileSync(destSSHConfig.private_key, 'utf8'),
            path: dest
        },
        function(err) {
            if (err) console.log(err);
            chmod(dest, destSSHConfig);
        }
    );
}

function chmod(key, sshConfig) {
    var c = new Client();
    c
        .on('ready', function() {
            c.exec(`chmod 600 ${key}`, function(err, stream) {
                if (err) throw err;
                stream
                    .on('close', function(code, signal) {
                        console.log(
                            'Stream :: close :: code: ' +
                                code +
                                ', signal: ' +
                                signal
                        );
                        c.end();
                    })
                    .on('data', function(data) {
                        console.log('STDOUT: ' + data);
                    })
                    .stderr.on('data', function(data) {
                        console.log('STDERR: ' + data);
                    });
            });
        })
        .connect({
            host: '127.0.0.1',
            port: sshConfig.port,
            username: sshConfig.user,
            privateKey: fs.readFileSync(sshConfig.private_key)
        });
}

function readBakerYaml(configFile)
{
    console.log("Reading Baker.yml")
    try {
        let doc = yaml.safeLoad(fs.readFileSync(configFile, 'utf8'));

        // Validate logic...

        // if( verbose )
        // console.log(JSON.stringify(doc, null, 3));

        return doc;
    } catch (e) {
        console.log(e);
    }
    return null;
}

async function promptOrGetValue(propertyName, property)
{
    if( property && property.hasOwnProperty("prompt"))
    {
        prompt.start();
        return new Promise((resolve, reject) => {
            prompt.get([{name: propertyName, description: property.prompt }], function (err, result)
            {
                if (err) { console.log(err); }
                resolve(result[propertyName]);
            });
        });
    }
    return property;
}

// We can get more fancy...
var properties = [
    {
      name: 'username',
      validator: /^[a-zA-Z\s\-]+$/,
      description: 'Username must be only letters, spaces, or dashes'
    },
    {
      name: 'password',
      hidden: true
    }
];

async function updateVagrantConfig(baseConfig, bakerDoc)
{
    let vagrant = bakerDoc.vagrant;
    if( vagrant.memory )
    {
        baseConfig.config.providers.virtualbox.memory = await promptOrGetValue("memory", vagrant.memory);
    }
    if( vagrant.network && vagrant.network.length > 0 )
    {
        vagrant.network.forEach(setting =>
        {
            if( setting.forwarded_port )
            {
                //config.network. = await promptOrGetValue(vagrant.memory)
            }
        });
    }
    if( vagrant.synced_folder )
    {

    }
}




async function bake(name, ansibleSSHConfig, ansibleVM) {
    let dir = path.join(boxes, name);
    let baseConfig = require('./config/base_vm.json');
    let bakerDoc = readBakerYaml('test/resources/prompt.yml')

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    await updateVagrantConfig(baseConfig, bakerDoc);

    let machine = vagrant.create({ cwd: dir });

    machine.init( await promptOrGetValue("box", bakerDoc.vagrant.box), baseConfig, function(err, out) {
        console.log(err || '==> Baking vm...');
        machine.up(async function(err, out) {
            console.log(err || '==> New VM is ready');
            let sshConfig = await getSSHConfig(machine);
            copyFromHostToVM(
                sshConfig.private_key,
                `/home/vagrant/${name}.key`,
                ansibleSSHConfig
            );
        });

        // machine.on("up-progress", function(data){
        //     //console.log(machine, progress, rate, remaining);
        //     console.log(data)
        // });

        return;
    });
}
