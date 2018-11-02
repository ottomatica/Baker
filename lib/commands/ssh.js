const Baker          = require('../modules/baker');
const conf           = require('../../lib/modules/configstore');
const Print          = require('../modules/print');
const Spinner        = require('../modules/spinner');
const spinnerDot     = conf.get('spinnerDot');

exports.command = 'ssh [VMName]';
exports.desc = 'ssh to a VM';

exports.builder = (yargs) => {
    yargs
        .example(`$0 ssh`, `SSH to Baker environment of current directory`)
        .example(`$0 ssh baker-test`, `SSH to 'baker-test' Baker VM`);

    // // TODO: bakePath is required for finding the envType.
    // // for now assuming the command is executed in same dir as baker.yml
    // yargs.positional('VMName', {
    //         describe: 'Name of the Baker VM',
    //         type: 'string'
    //     });

    yargs.options(
        {
            useContainer: {
                describe: `Override environment type to use container`,
                demand: false,
                type: 'boolean'
            },
            useVM: {
                describe: `Override environment type to use vm`,
                demand: false,
                type: 'boolean'
            }
        }
    );
}

exports.handler = async function(argv) {
    let { useContainer, useVM } = argv;

    try {
        let bakePath = process.cwd();
        const {envName, BakerObj} = await Baker.chooseProvider(bakePath, useContainer, useVM);

        await BakerObj.ssh(envName);

        //await Spinner.spinPromise(BakerObj.ssh(envName), `SSHing to ${envName}`, spinnerDot);
    } catch (err) {
        Print.error(err);
    }
}
