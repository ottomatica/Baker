const { commands, modules } = require('../../baker');
const ssh = modules['ssh'];
const path = require('path');

async function start(cmd,sshConfig)
{
    //await ssh.sshExec(`nohup ${cmd} &`, sshConfig, true);
    await ssh.sshExec(`${cmd}`, sshConfig, true);
}

module.exports = start;