'use strict';

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'status';
    cmd.desc = `show status for all Baker VMs`;
    cmd.builder = {};
    cmd.handler = async function(argv) {
        const { baker } = dep;

        await baker.status();
    };

    return cmd;
};
