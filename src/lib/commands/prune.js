'use strict';

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'prune';
    cmd.desc = 'prunes invalid VMs (e.g. partially removed due to a failure)';
    cmd.builder = {};
    cmd.handler = async function(argv) {
        const { child_process, baker } = dep;

        child_process.execSync('vagrant global-status --prune', {
            stdio: 'inherit'
        });

        // Show status after prune completed
        await baker.status();
    };

    return cmd;
};
