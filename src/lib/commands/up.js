const Baker   = require('../modules/baker');
const conf    = require('../../lib/modules/configstore')
const Print   = require('../modules/print');
const Spinner = require('../modules/spinner');

const spinnerDot = conf.get('spinnerDot');

exports.command = ['start [VMName]', 'up [VMName]'];
exports.desc = `start a VM`;

exports.builder = (yargs) => {
    yargs
        .example(`$0 up`, `Start the Baker VM of current directory`)
        .example(`$0 up baker-test`, `Start 'baker-test' Baker VM`);

    // TODO: bakePath is required for finding the envType.
    // for now assuming the command is executed in same dir as baker.yml
    // yargs
    //     .positional('VMName', {
    //         describe: 'Name of the Baker VM to Start',
    //         type: 'string'
    //     });
}

exports.handler = async function(argv) {
    let { envName, verbose } = argv;

    try{
        // if(!VMName){
        //     let cwdVM = (await Baker.getCWDBakerYML());
        //     if(cwdVM)
        //         VMName = (await Baker.getCWDBakerYML()).name;
        //     else {
        //         Print.error(`Couldn't find baker.yml in cwd. Run the command in a directory with baker.yml or specify a VMName.`);
        //         process.exit(1);
        //     }
        // }

        let bakePath = process.cwd();
        const {envName, BakerObj} = await Baker.chooseProvider(bakePath);

        await Spinner.spinPromise(BakerObj.start(envName, verbose), `Starting VM: ${envName}`, spinnerDot);
    } catch (err){
        Print.error(err);
    }
}
