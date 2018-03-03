const Baker          = require('../modules/baker');
const Print          = require('../modules/print');
const Spinner        = require('../modules/spinner');
const { spinnerDot } = require('../../global-vars');

exports.command = 'destroy [VMName]';
exports.desc = `remove a VM and it's associated files`;
exports.builder = (yargs) => {
    yargs
        .example(`$0 destroy`, `Destroys the VM build from baker.yml of current directory`)
        .example(`$0 destroy baker-test`, `Destroys baker-test VM`);

    yargs.positional('VMName', {
            describe: 'Name of the VM to be destroyed',
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

        await Spinner.spinPromise(Baker.destroyVM(VMName), `Destroying VM: ${VMName}`, spinnerDot);
    } catch (err) {
        Print.error(err);
    }
}
