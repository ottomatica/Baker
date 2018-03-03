const path    = require('path');
const Ssh = require('../modules/ssh');

class Bakelet
{
    constructor(ansibleSSHConfig)
    {
        this.ansibleSSHConfig = ansibleSSHConfig;
    }

    setRemotesPath(remotesPath)
    {
        this.remotesPath = remotesPath;
    }

    setBakePath(bakePath)
    {
        this.bakePath = bakePath;
    }

    setVerbose(verbose)
    {
        this.verbose = verbose;
    }

    async copy(src,dest)
    {
        // Copy common ansible scripts files
        await Ssh.copyFromHostToVM(
            src,
            dest,
            this.ansibleSSHConfig,
            false
        );
    }

    async exec(cmd) {
        // Run cmd on remote server
        await Ssh.sshExec(cmd, this.ansibleSSHConfig, this.verbose);
    }
}

module.exports = Bakelet;
