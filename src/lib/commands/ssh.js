'use strict';

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'ssh <VMName>';
    cmd.desc = 'ssh to a VM';
    cmd.builder = {};
    cmd.handler = async function(argv) {
        const { VMName } = argv;
        const { baker, print, spinner, spinnerDot } = dep;

        try {
            await spinner.spinPromise(baker.bakerSSH(VMName), `SSHing to ${VMName}`, spinnerDot);
        } catch (err) {
            print.error(err);
        }
    };

    return cmd;
};
