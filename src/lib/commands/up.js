const Baker   = require('../modules/baker');
const conf    = require('../../lib/modules/configstore')
const Print   = require('../modules/print');
const Spinner = require('../modules/spinner');
const VagrantProvider = require('../modules/providers/vagrant');

const spinnerDot = conf.get('spinnerDot');

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
    let { VMName, verbose } = argv;

    //TODO: if vagrant:
    const provider = new VagrantProvider();
    const BakerObj = new Baker(provider);

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

        await Spinner.spinPromise(BakerObj.start(VMName, verbose), `Starting VM: ${VMName}`, spinnerDot);
    } catch (err){
        Print.error(err);
    }
}
