const Baker          = require('../modules/baker');
const conf           = require('../../lib/modules/configstore');
const Print          = require('../modules/print');
const Spinner        = require('../modules/spinner');
const spinnerDot     = conf.get('spinnerDot');

exports.command = 'halt [VMName]';
exports.desc = `shut down a VM`;

exports.builder = (yargs) => {
    yargs
        .example(`$0 halt`, `Halts the VM build from baker.yml of current directory`)
        .example(`$0 halt baker-test`, `Halts baker-test VM`);

    yargs.positional('VMName', {
            describe: 'Name of the VM to be halted',
            type: 'string'
        });

    yargs.options({
            force: {
                alias: 'f',
                describe: `force shut down`,
                demand: false,
                type: 'boolean'
            }
        });
}

exports.handler = async function(argv) {
    let { VMName, force } = argv;

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

        await Spinner.spinPromise(Baker.haltVM(VMName, force), `Stopping VM: ${VMName}`, spinnerDot);
    } catch(err) {
        Print.error(err);
    }
}
