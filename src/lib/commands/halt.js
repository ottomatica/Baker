'use strict';

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'halt <VMName>';
    cmd.desc = `shut down a VM`;
    cmd.builder = {
        force: {
            alias: 'f',
            describe: `force shut down`,
            demand: false,
            type: 'boolean'
        }
    };

    cmd.handler = async function(argv) {
        const { baker, print, spinner, spinnerDot } = dep;
        const { VMName, force } = argv;

        try {
            await spinner.spinPromise(baker.haltVM(VMName, force), `Stopping VM: ${VMName}`, spinnerDot);
        } catch(err) {
            print.error(err);
        }
    };

    return cmd;
};
