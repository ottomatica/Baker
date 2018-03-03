'use strict';

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'destroy [VMName]';
    cmd.desc = `remove a VM and it's associated files`;
    cmd.builder = {};
    cmd.handler = async function(argv) {
        const { baker, print, spinner, spinnerDot } = dep;
        let { VMName } = argv;

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

            await spinner.spinPromise(baker.destroyVM(VMName), `Destroying VM: ${VMName}`, spinnerDot);
        } catch (err) {
            print.error(err);
        }
    };

    return cmd;
};
