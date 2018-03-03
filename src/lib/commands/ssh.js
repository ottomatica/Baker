'use strict';

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'ssh [VMName]';
    cmd.desc = 'ssh to a VM';
    cmd.builder = {};
    cmd.handler = async function(argv) {
        let { VMName } = argv;
        const { baker, print, spinner, spinnerDot } = dep;

        try {
            if(!VMName){
                let cwdVM = (await baker.getCWDBakerYML());
                if(cwdVM)
                    VMName = (await baker.getCWDBakerYML()).name;
                else {
                    print.error(`Couldn't find baker.yml in cwd. Run the command in a directory with baker.yml or specify a VMName.`);
                    process.exit(1);
                }
            }

            await spinner.spinPromise(baker.bakerSSH(VMName), `SSHing to ${VMName}`, spinnerDot);
        } catch (err) {
            print.error(err);
        }
    };

    return cmd;
};
