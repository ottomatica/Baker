'use strict';

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'prune';
    cmd.desc = 'prunes invalid VMs (e.g. partially removed due to a failure)';
    cmd.builder = {};
    cmd.handler = async function(argv) {
        const { child_process } = dep;

        // TODO: After added --status command, update this to show that after completed.
        child_process.execSync('vagrant global-status --prune', {
            stdio: 'inherit'
        });
    };

    return cmd;
};
