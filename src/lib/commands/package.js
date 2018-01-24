'use strict';

module.exports = function(dep) {
    let cmd = {};
    cmd.builder = {
        verbose: {
            alias: 'v',
            describe: `Provide extra output from baking process`,
            demand: false,
            type: 'boolean'
        }
    };
    cmd.command = 'package <VMName>';
    cmd.desc = `package a Baker environment`;
    cmd.handler = async function(argv) {
        const { baker, print, spinner, spinnerDot } = dep;
        const { VMName, verbose } = argv;

        try {
            await spinner.spinPromise(baker.package(VMName, verbose), `Packaging box: ${VMName}`, spinnerDot);
        } catch (err) {
            print.error(err);
        }
    };

    return cmd;
};


