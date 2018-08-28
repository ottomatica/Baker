const os             = require('os');
const child_process  = require('child_process');
const Baker          = require('../modules/baker');
const conf           = require('../../lib/modules/configstore')
const Print          = require('../modules/print');
const Spinner        = require('../modules/spinner');
const spinnerDot     = conf.get('spinnerDot');

exports.command = 'status';
exports.desc = `Show status for all Baker VMs`;
exports.handler = async function(argv) {

    try {
//        await Spinner.spinPromise(Baker.list(), `Getting status of Baker environments`, spinnerDot);
        let status = checkVirtualization();
        console.log(`Virtualization support: ${status}`);
        if( status != "yes" )
        {
            console.log("Please confirm you have virtualization enabled in your BIOS.");
        }
        await Baker.list();
    } catch (err) {
        Print.error(err);
    }
}

function checkVirtualization()
{
    let status = "unknown";
    if( os.platform() == 'win32')
    {
        let output = child_process.execSync('systeminfo');
        if( output && output.toString().indexOf("Virtualization Enabled In Firmware: Yes") != -1)
        {
            status = "yes";
        }
        else {
            status = "no";
        }
    }
    else if( os.platform() == 'darwin' )
    {
        let output = child_process.execSync('sysctl -a | grep machdep.cpu.features');
        if( output && output.toString().indexOf("VMX") != -1 )
        {
            return "yes";
        }
        else {
            status = "no";
        }
    }
    return status;
}
