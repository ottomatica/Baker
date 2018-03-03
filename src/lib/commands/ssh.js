const Baker          = require('../modules/baker');
const Print          = require('../modules/print');
const Spinner        = require('../modules/spinner');
const { spinnerDot } = require('../../global-vars');

exports.command = 'ssh [VMName]';
exports.desc = 'ssh to a VM';

exports.builder = (yargs) => {
    yargs
        .example(`$0 ssh`, `SSH to Baker environment of current directory`)
        .example(`$0 ssh baker-test`, `SSH to 'baker-test' Baker VM`);

    yargs.positional('VMName', {
            describe: 'Name of the Baker VM',
            type: 'string'
        });
}

exports.handler = async function(argv) {
    let { VMName } = argv;

    try {
        if(!VMName){
            let cwdVM = (await Baker.getCWDBakerYML());
            if(cwdVM)
                VMName = (await Baker.getCWDBakerYML()).name;
            else {
                Print.error(`Couldn't find baker.yml in cwd. Run the command in a directory with baker.yml or specify a VMName.`);
                process.exit(1);
            }
        }

        await Spinner.spinPromise(Baker.bakerSSH(VMName), `SSHing to ${VMName}`, spinnerDot);
    } catch (err) {
        Print.error(err);
    }
}
