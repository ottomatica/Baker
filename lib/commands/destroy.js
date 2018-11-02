const Baker          = require('../modules/baker');
const conf           = require('../../lib/modules/configstore');
const Print          = require('../modules/print');
const Spinner        = require('../modules/spinner');
const spinnerDot     = conf.get('spinnerDot');
const Servers        = require('../modules/servers');

exports.command = ['delete [VMName]', 'destroy [VMName]'];
exports.desc = `remove a VM and it's associated files`;
exports.builder = (yargs) => {
    yargs
        .example(`$0 destroy`, `Destroys the VM build from baker.yml of current directory`)
        .example(`$0 destroy baker-test`, `Destroys baker-test VM`);

    // TODO: bakePath is required for finding the envType.
    // for now assuming the command is executed in same dir as baker.yml
    // yargs.positional('envName', {
    //         describe: 'Name of the environment to be destroyed',
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
            },
            forceVirtualBox: {
                describe: `Force using virtualbox instead of xhyve VM on Mac (no effect on Windows/Linux)`,
                hidden: true, // just for debugging for now
                demand: false,
                type: 'boolean'
            }
        }
    );

}

exports.handler = async function(argv) {
    let { envName, useContainer, useVM, forceVirtualBox } = argv;

    try {
        let bakePath = process.cwd();
        const {envName, BakerObj} = await Baker.chooseProvider(bakePath, useContainer, useVM);

        // ensure baker server is running
        await Servers.installBakerServer(forceVirtualBox);

        await Spinner.spinPromise(BakerObj.delete(envName), `Destroying VM: ${envName}`, spinnerDot);
    } catch (err) {
        Print.error(err);
    }
}
