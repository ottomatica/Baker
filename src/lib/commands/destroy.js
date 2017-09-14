'use strict';

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'destroy <VMName>';
    cmd.desc = `remove a VM and it's associated files`;
    cmd.builder = {};
    cmd.handler = async function(argv) {
        const { baker, print } = dep;
        const { VMName } = argv;

        try {
            await baker.destroyVM(VMName);
            print.success(`Destroyed VM: ${VMName}`);
        } catch (err) {
            print.error(err);
        }
    };

    return cmd;
};
