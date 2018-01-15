const { commands, modules } = require('../../baker');
const ssh = modules['ssh'];
const path = require('path');

async function start(cmd,sshConfig,verbose)
{
    //await ssh.sshExec(`nohup bash -c '${cmd}' & exit 0`, sshConfig, true);
    await ssh.sshExec(`nohup bash -c "${cmd}" > ~/start.out 2> ~/start.err &`, sshConfig, verbose);
    // https://stackoverflow.com/questions/29142/getting-ssh-to-execute-a-command-in-the-background-on-target-machine
    // can consider a keepalive option for start if want to see the output without redirecting.

}

module.exports = start;