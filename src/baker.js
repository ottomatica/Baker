const path = require("path");
const fs = require('fs-extra');
const vagrant = require('node-vagrant');
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
        checkAnsible();
    


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
