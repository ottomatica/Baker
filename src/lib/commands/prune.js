'use strict';

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'prune';
    cmd.desc = 'prunes invalid VMs (e.g. partially removed due to a failure)';
    cmd.builder = {};
    cmd.handler = async function(argv) {
        const { baker } = dep;

        baker.prune();
    };

    return cmd;
};
