const path = require("path");
const fs = require('fs-extra');
const vagrant = require('node-vagrant');
const scp2 = require("scp2");

var child_process = require("child_process");
const program = require('./help').parse(process.argv); // The --help page

var boxes = path.join(require('os').homedir(), ".baker");
var ansible = path.join(boxes, "ansible-srv");

function main()
{
    if( !fs.existsSync(boxes))
    {
        fs.mkdirSync(boxes);
    }
    if( !fs.existsSync(ansible))
    {
        fs.mkdirSync(ansible);
    }

    // if(argv._.includes('help') || argv.help || argv.h)
    //     help();

    // console.log(program)
    if(program.install)
    {
        checkAnsible();
    }
    else
    {
        var ansibleVM = vagrant.create({ cwd: ansible });
        getSSHConfig(ansibleVM, function(sshConfig)
        {
            bake("test", sshConfig, ansibleVM);

        });

    }

}

main();

function checkAnsible()
{
    var machine = vagrant.create({ cwd: ansible });
    var config = require('./config/ansible_vm.json');

    fs.copySync(path.resolve(__dirname,'./config/provision.shell.sh'), 
                path.resolve(ansible,'provision.shell.sh')
    );

    machine.init('ubuntu/trusty64', config, function(err, out)
    {
        console.log( err || "creating ansible server..." );

        child_process.execSync(`cd ${ansible} && vagrant up`, {stdio: 'inherit'})
        /*
        machine.up(function(err, out)
        {
            console.log( out );
            console.log( err || "ready" );
        });
        machine.on("up-progress", function(data)
        {
            console.log(data);
        })
        */
    });
}

function getSSHConfig(machine, callback)
{
    machine.sshConfig(function(err, sshConfig)
    {
        console.log( err || "ssh info:" );
        if( sshConfig && sshConfig.length > 0 )
        {
            callback(sshConfig[0])
        }
        else
        {
            callback(err);
        }
    });
}

function copyFromHostToVM(src, dest, destSSHConfig)
{
    scp2.scp(src, 
    {
        host: '127.0.0.1',
        port: destSSHConfig.port,
        username: destSSHConfig.user,
        privateKey: fs.readFileSync( destSSHConfig.private_key),
        path: dest
    }, function(err) {console.log(err)})
}


function bake(name, ansibleSSHConfig, ansibleVM)
{
    var dir = path.join(boxes, name);
    var config = require('./config/base_vm.json');

    if( !fs.existsSync(dir))
    {
        fs.mkdirSync(dir);
    }

    var machine = vagrant.create({ cwd: dir });

    machine.init('ubuntu/trusty64', config, function(err, out)
    {
        console.log( err || "baking vm..." );
        machine.up(function(err, out)
        {
            console.log( out );
            console.log( err || "ready" );

            getSSHConfig(machine, function(sshConfig)
            {
                copyFromHostToVM(sshConfig.private_key, `/home/vagrant/${name}.key`, ansibleSSHConfig)
            });

        });
        machine.on("up-progress", function(data)
        {
            //console.log(machine, progress, rate, remaining);
            console.log(data)
        });
    });

}