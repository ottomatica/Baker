const Baker          = require('../modules/baker');
const Print          = require('../modules/print');
const Spinner        = require('../modules/spinner');
const { spinnerDot } = require('../../global-vars');

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
        const { VMName, verbose } = argv;

        try {
            await Spinner.spinPromise(Baker.package(VMName, verbose), `Packaging box: ${VMName}`, spinnerDot);
        } catch (err) {
            Print.error(err);
        }
    };

    return cmd;
};


