'use strict';

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'up <VMName>';
    cmd.desc = `start a VM`;
    cmd.builder = {};

    cmd.handler = async function(argv) {
        const { baker } = dep;
        const { VMName } = argv;

        await baker.upVM(VMName);
    };

    return cmd;
};
