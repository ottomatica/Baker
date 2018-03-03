const Baker          = require('../modules/baker');
const Print          = require('../modules/print');
const Spinner        = require('../modules/spinner');
const { spinnerDot } = require('../../global-vars');

module.exports = function(dep) {
    let cmd = {};

    cmd.command = 'destroy [VMName]';
    cmd.desc = `remove a VM and it's associated files`;
    cmd.builder = {};
    cmd.handler = async function(argv) {
        let { VMName } = argv;

        try {
            if(!VMName){
                let cwdVM = (await Baker.getCWDBakerYML());
                if(cwdVM)
                    VMName = (await Baker.getCWDBakerYML()).name;
                else {
                    Print.error(`Couldn't find baker.yml in cwd. Run the command in a directory with baker.yml or specify a VMName.`);
                    process.exit(1);
                }
            }

            await Spinner.spinPromise(Baker.destroyVM(VMName), `Destroying VM: ${VMName}`, spinnerDot);
        } catch (err) {
            Print.error(err);
        }
    };

    return cmd;
};
