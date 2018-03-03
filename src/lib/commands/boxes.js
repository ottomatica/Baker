const Baker     = require('../modules/baker');
const Print     = require('../modules/print');
const Spinner   = require('../modules/spinner');

const { spinnerDot } = require('../../global-vars');

module.exports = function(dep) {
    let cmd = {};
    cmd.builder = { };
    cmd.command = 'boxes';
    cmd.desc = `list existing Baker boxes`;
    cmd.handler = async function(argv) {
        const { verbose } = argv;

        try {
            await Spinner.spinPromise(Baker.bakerBoxes(), `Getting list of Baker boxes`, spinnerDot);
        } catch (err) {
            Print.error(err);
        }
    };

    return cmd;
};


