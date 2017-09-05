'use strict';

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'ssh <VMName>';
    cmd.desc = 'ssh to a VM';
    cmd.builder = {};
    cmd.handler = async function(argv) {
        const { VMName } = argv;
        const { baker } = dep;

        baker.bakerSSH(VMName);
    };

    return cmd;
};
