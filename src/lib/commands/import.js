const Baker          = require('../modules/baker');
const conf           = require('../../lib/modules/configstore');
const Print          = require('../modules/print');
const Spinner        = require('../modules/spinner');
const spinnerDot     = conf.get('spinnerDot');

exports.command = 'import <boxPath>';
exports.desc = `Import packaged Baker environment`;

exports.builder = (yargs) => {
    yargs.example(`$0 import ./baker.box`, `Import a Baker Box`)

    yargs.positional('boxPath', {
            describe: 'Path to the .box file',
            type: 'string'
        });

    yargs.options({
        name: {
            alias: 'n',
            describe: `Provide name for the imported box`,
            demand: false,
            type: 'string'
        },
        verbose: {
            alias: 'v',
            describe: `Provide extra output from baking process`,
            demand: false,
            type: 'boolean'
        }
    });
}

exports.handler = async function(argv) {
    const { boxPath, name, verbose } = argv;

    try {
        await Spinner.spinPromise(Baker.import(boxPath, verbose), `Importing box: ${boxPath}`, spinnerDot);
    } catch (err) {
        Print.error(err);
    }
}
