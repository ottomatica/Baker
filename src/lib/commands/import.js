const Baker          = require('../modules/baker');
const Print          = require('../modules/print');
const Spinner        = require('../modules/spinner');
const { spinnerDot } = require('../../global-vars');

module.exports = function(dep) {
    let cmd = {};
    cmd.builder = {
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
    };
    cmd.command = 'import <boxPath>';
    cmd.desc = `import packaged Baker environment`;
    cmd.handler = async function(argv) {
        const { boxPath, name, verbose } = argv;

        try {
            await Spinner.spinPromise(Baker.import(boxPath, verbose), `Importing box: ${boxPath}`, spinnerDot);
        } catch (err) {
            Print.error(err);
        }
    };

    return cmd;
};


