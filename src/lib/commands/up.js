'use strict';

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'up <VMName>';
    cmd.desc = `start a VM`;
    cmd.builder = {};

    cmd.handler = async function(argv) {
        const { baker, print, spinner, spinnerDot } = dep;
        const { VMName } = argv;

        try{
            await spinner.spinPromise(baker.upVM(VMName), `Starting VM: ${VMName}`, spinnerDot);
        } catch (err){
            print.error(err);
        }
    };

    return cmd;
};
