const Baker   = require('../modules/baker');
const Print   = require('../modules/print');
const Spinner = require('../modules/spinner');

const { spinnerDot } = require('../../global-vars');

exports.command = 'up [VMName]';
exports.desc = `start a VM`;

exports.builder = (yargs) => {
    yargs
        .example(`$0 up`, `Start the Baker VM of current directory`)
        .example(`$0 up baker-test`, `Start 'baker-test' Baker VM`);

    yargs
        .positional('VMName', {
            describe: 'Name of the Baker VM to Start',
            type: 'string'
        });
}

exports.handler = async function(argv) {
    let { VMName } = argv;

    try{
        if(!VMName){
            let cwdVM = (await Baker.getCWDBakerYML());
            if(cwdVM)
                VMName = (await Baker.getCWDBakerYML()).name;
            else {
                Print.error(`Couldn't find baker.yml in cwd. Run the command in a directory with baker.yml or specify a VMName.`);
                process.exit(1);
            }
        }

        await Spinner.spinPromise(Baker.upVM(VMName), `Starting VM: ${VMName}`, spinnerDot);
    } catch (err){
        Print.error(err);
    }
}
