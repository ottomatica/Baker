'use strict';

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'destroy <VMName>';
    cmd.desc = `remove a VM and it's associated files`;
    cmd.builder = {};
    cmd.handler = async function(argv) {
        const { baker, print, spinner, spinnerDot } = dep;
        const { VMName } = argv;

        try {
            await spinner.spinPromise(baker.destroyVM(VMName), `Destroying VM: ${VMName}`, spinnerDot);
        } catch (err) {
            print.error(err);
        }
    };

    return cmd;
};
