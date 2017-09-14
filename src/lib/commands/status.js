'use strict';

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'status';
    cmd.desc = `show status for all Baker VMs`;
    cmd.builder = {};
    cmd.handler = async function(argv) {
        const { baker, print, spinner, spinnerDot } = dep;

        try {
            await spinner.spinPromise(baker.status(), `Getting status of Baker VMs`, spinnerDot);
        } catch (err) {
            print.error(err);
        }
    };

    return cmd;
};
