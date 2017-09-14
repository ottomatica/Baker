'use strict';

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'up <VMName>';
    cmd.desc = `start a VM`;
    cmd.builder = {};

    cmd.handler = async function(argv) {
        const { baker, print } = dep;
        const { VMName } = argv;

        try{
            await baker.upVM(VMName);
            print.success(`Started VM: ${VMName}`);
        } catch (err){
            print.error(err);
        }
    };

    return cmd;
};
