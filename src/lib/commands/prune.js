const Baker          = require('../modules/baker');
const Print          = require('../modules/print');
const Spinner        = require('../modules/spinner');
const { spinnerDot } = require('../../global-vars');

exports.command = 'prune';
exports.desc = 'Prunes invalid VMs';
exports.handler = async function(argv) {
    try {
        await Spinner.spinPromise(Baker.prune(), 'Removing invalid VM enteries.', spinnerDot);
    } catch(err){
        Print.error(err);
    }
}
