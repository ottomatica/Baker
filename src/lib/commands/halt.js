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
        const { baker, print } = dep;
        const { VMName, force } = argv;

        try {
            await baker.haltVM(VMName, force);
            print.success(`Stopped VM: ${VMName}`);
        } catch(err) {
            print.error(err);
        }
    };

    return cmd;
};
