'use strict';

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'status';
    cmd.desc = `show status for all Baker VMs`;
    cmd.builder = {};
    cmd.handler = async function(argv) {
        const { baker, print } = dep;

        try {
            await baker.status();
        } catch (err) {
            print.error(err);
        }
    };

    return cmd;
};
