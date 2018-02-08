'use strict';

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
        const { baker, print, spinner, spinnerDot } = dep;
        const { boxPath, name, verbose } = argv;

        try {
            await spinner.spinPromise(baker.import(boxPath, verbose), `Importing box: ${boxPath}`, spinnerDot);
        } catch (err) {
            print.error(err);
        }
    };

    return cmd;
};


