const Baker          = require('../modules/baker');
const Print          = require('../modules/print');
const Spinner        = require('../modules/spinner');
const { spinnerDot } = require('../../global-vars');

exports.command = 'status';
exports.desc = `Show status for all Baker VMs`;
exports.handler = async function(argv) {
    try {
        await Spinner.spinPromise(Baker.status(), `Getting status of Baker VMs`, spinnerDot);
    } catch (err) {
        Print.error(err);
    }
}
