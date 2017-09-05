'use strict';

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'destroy <VMName>';
    cmd.desc = `remove a VM and it's associated files`;
    cmd.builder = {};
    cmd.handler = async function(argv) {
        const { baker } = dep;
        const { VMName } = argv;

        baker.destroyVM(await baker.getVagrantIDByName(VMName));
    };

    return cmd;
};
