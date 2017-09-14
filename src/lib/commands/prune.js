'use strict';

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'prune';
    cmd.desc = 'prunes invalid VMs (e.g. partially removed due to a failure)';
    cmd.builder = {};
    cmd.handler = async function(argv) {
        const { baker, print } = dep;

        try {
            await baker.prune();
            print.info('Removed invalid VM enteries.')
        } catch(err){
            print.error(err);
        }
    };

    return cmd;
};
