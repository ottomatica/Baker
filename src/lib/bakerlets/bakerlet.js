const { commands, modules } = require('../../baker');
const ssh = modules['ssh'];
const path = require('path');

class Bakerlet
{
    constructor(ansibleSSHConfig)
    {
        this.ansibleSSHConfig = ansibleSSHConfig;
    }

    setRemotesPath(remotesPath)
    {
        this.remotesPath = remotesPath;
    }

    async copy(src,dest)
    {
        // Copy common ansible scripts files
        await ssh.copyFromHostToVM(
            src,
            dest,
            this.ansibleSSHConfig,
            false
        );
    }

}

module.exports = Bakerlet;