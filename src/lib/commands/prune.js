'use strict';

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'prune';
    cmd.desc = 'prunes invalid VMs (e.g. partially removed due to a failure)';
    cmd.builder = {};
    cmd.handler = async function(argv) {
        const { baker, print, spinner, spinnerDot } = dep;

        try {
            await spinner.spinPromise(baker.prune(), 'Removing invalid VM enteries.', spinnerDot);
        } catch(err){
            print.error(err);
        }
    };

    return cmd;
};
