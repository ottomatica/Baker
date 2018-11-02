const Baker     = require('../modules/baker');
const conf      = require('../../lib/modules/configstore');
const Print     = require('../modules/print');
const Spinner   = require('../modules/spinner');
const VagrantProvider = require('../modules/providers/vagrant');

const spinnerDot = conf.get('spinnerDot');

exports.command = 'boxes';
exports.desc = `list existing Baker boxes`;
exports.handler = async function(argv) {
    const { verbose } = argv;

    const provider = new VagrantProvider();

    try {
        await Spinner.spinPromise(provider.bakerBoxes(), `Getting list of Baker boxes`, spinnerDot);
    } catch (err) {
        Print.error(err);
    }
}
