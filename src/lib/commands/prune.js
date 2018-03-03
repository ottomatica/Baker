const Baker          = require('../modules/baker');
const Print          = require('../modules/print');
const Spinner        = require('../modules/spinner');
const { spinnerDot } = require('../../global-vars');

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'prune';
    cmd.desc = 'prunes invalid VMs (e.g. partially removed due to a failure)';
    cmd.builder = {};
    cmd.handler = async function(argv) {
        try {
            await Spinner.spinPromise(Baker.prune(), 'Removing invalid VM enteries.', spinnerDot);
        } catch(err){
            Print.error(err);
        }
    };

    return cmd;
};
