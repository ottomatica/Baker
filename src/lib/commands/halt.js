const Baker          = require('../modules/baker');
const conf           = require('../../lib/modules/configstore');
const Print          = require('../modules/print');
const Spinner        = require('../modules/spinner');
const spinnerDot     = conf.get('spinnerDot');
const Utils          = require('../modules/utils/utils');

exports.command = ['stop [VMName]', 'halt [VMName]'];
exports.desc = `shut down a VM`;

exports.builder = (yargs) => {
    yargs
        .example(`$0 halt`, `Halts the VM build from baker.yml of current directory`)
        .example(`$0 halt baker-test`, `Halts baker-test VM`);

    // TODO: bakePath is required for finding the envType.
    // for now assuming the command is executed in same dir as baker.yml
    // yargs.positional('envName', {
    //         describe: 'Name of the environment to stop',
    //         type: 'string'
    //     });

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
    let { envName, force } = argv;

    try {
        // if(!envName){
        //     let cwdVM = (await Baker.getCWDBakerYML());
        //     if(cwdVM)
        //         envName = (await Baker.getCWDBakerYML()).name;
        //     else {
        //         Print.error(`Couldn't find baker.yml in cwd. Run the command in a directory with baker.yml or specify a VMName.`);
        //         process.exit(1);
        //     }
        // }

        let bakePath = process.cwd();
        const {envName, BakerObj} = await Utils.chooseProvider(bakePath);

        await Spinner.spinPromise(BakerObj.stop(envName, force), `Stopping VM: ${envName}`, spinnerDot);
    } catch(err) {
        Print.error(err);
    }
}
