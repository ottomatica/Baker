const conf           = require('../../lib/modules/configstore');
const Print          = require('../modules/print');
const Spinner        = require('../modules/spinner');
const spinnerDot     = conf.get('spinnerDot');
const VagrantProvider = require('../modules/providers/vagrant');

exports.command = 'prune';
exports.desc = 'Prunes invalid VMs';
exports.handler = async function(argv) {
    try {
        await Spinner.spinPromise(VagrantProvider.prune(), 'Removing invalid VM enteries.', spinnerDot);
    } catch(err){
        Print.error(err);
    }
}
