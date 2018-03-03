const Baker          = require('../modules/baker');
const Print          = require('../modules/print');
const Spinner        = require('../modules/spinner');
const { spinnerDot } = require('../../global-vars');

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'status';
    cmd.desc = `show status for all Baker VMs`;
    cmd.builder = {};
    cmd.handler = async function(argv) {
        try {
            await Spinner.spinPromise(Baker.status(), `Getting status of Baker VMs`, spinnerDot);
        } catch (err) {
            Print.error(err);
        }
    };

    return cmd;
};
