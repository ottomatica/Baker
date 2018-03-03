'use strict';

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'halt [VMName]';
    cmd.desc = `shut down a VM`;
    cmd.builder = {
        force: {
            alias: 'f',
            describe: `force shut down`,
            demand: false,
            type: 'boolean'
        }
    };

    cmd.handler = async function(argv) {
        const { baker, print, spinner, spinnerDot } = dep;
        let { VMName, force } = argv;

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

            await spinner.spinPromise(baker.haltVM(VMName, force), `Stopping VM: ${VMName}`, spinnerDot);
        } catch(err) {
            print.error(err);
        }
    };

    return cmd;
};
