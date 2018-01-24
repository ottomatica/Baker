'use strict';

module.exports = function(dep) {
    let cmd = {};
    cmd.builder = { };
    cmd.command = 'boxes';
    cmd.desc = `list existing Baker boxes`;
    cmd.handler = async function(argv) {
        const { baker, print, spinner, spinnerDot } = dep;
        const { verbose } = argv;

        try {
            await spinner.spinPromise(baker.bakerBoxes(), `Getting list of Baker boxes`, spinnerDot);
        } catch (err) {
            print.error(err);
        }
    };

    return cmd;
};


