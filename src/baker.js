
var path = require("path");
var fs = require('fs-extra');
var vagrant = require('node-vagrant');


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

        machine.up(function(err, out)
        {
            console.log( err || "ready" );
        });
    });
}