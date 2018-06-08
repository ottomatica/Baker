const Baker          = require('../modules/baker');
const conf           = require('../../lib/modules/configstore');
const Print          = require('../modules/print');
const Spinner        = require('../modules/spinner');
const spinnerDot     = conf.get('spinnerDot');

exports.command = 'package <VMName>';
exports.desc = `package a Baker environment`;

exports.builder = (yargs) => {
    yargs.example(`$0 package baker-test`, `Packages 'baker-test' Baker VM`);

    yargs.positional('VMName', {
            describe: 'Name of the VM to be packaged',
            type: 'string'
        });

    yargs.options({
        verbose: {
            alias: 'v',
            describe: `Provide extra output from baking process`,
            demand: false,
            type: 'boolean'
        }
    });
}

exports.handler = async function(argv) {
    const { VMName, verbose } = argv;

    try {
        await Spinner.spinPromise(Baker.package(VMName, verbose), `Packaging box: ${VMName}`, spinnerDot);
    } catch (err) {
        Print.error(err);
    }
}
