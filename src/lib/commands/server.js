const path          = require('path');

const Print         = require('../modules/print');
const Ssh         = require('../modules/ssh');
//const Spinner       = require('../modules/spinner');
//const spinnerDot    = conf.get('spinnerDot');

const { configPath, boxes, bakerForMacPath, bakerSSHConfig } = require('../../global-vars');


exports.command = 'server <cmdlet> [name]';
// exports.aliases = ['$0'];
exports.desc = 'Control the baker machine';
exports.builder = (yargs) => {
    yargs
        .example(`$0 server ssh`, `ssh into the baker machine.`)
        .example(`$0 server repair broken-machine`, `Perform fixes, such as repairing a locked dpkg`);

    yargs.positional('cmdlet', {
        describe: 'Command to run:',
        type: 'string'
    });

    yargs.positional('name', {
        describe: 'Optional target of cmdlet:',
        type: 'string'
    });
}

exports.handler = async function(argv) {
    const { cmdlet, name } = argv;

    try{
        switch( cmdlet )
        {
            case "ssh":
                Ssh.SSH_Session(bakerSSHConfig);
                break;
            case "repair":
                if( !name )
                    throw new Error("You provide the name of the baker environment you want to repair.");

                let location = `cd /home/vagrant/baker/${name}`;
                let ansibleCmd = `ansible all -v -i baker_inventory --become -m shell -a`;
                let repairCmd = `rm -f /var/lib/dpkg/lock && dpkg --configure -a`;

                let cmd = `${location} && ${ansibleCmd} "${repairCmd}"`;

                await Ssh.sshExec(cmd, bakerSSHConfig, 20000, true ).catch(e => e);

                break;
            default:
        }

    } catch (err) {
        Print.error(err);
    }

}
