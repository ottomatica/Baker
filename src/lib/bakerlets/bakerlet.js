class Bakerlet
{
    constructor(configPath,ansibleSSHConfig)
    {
        this.configPath = configPath;
        this.ansibleSSHConfig = ansibleSSHConfig;
    }

    async copy(src,dest)
    {
        // Copy common ansible scripts files
        await ssh.copyFromHostToVM(
            path.resolve(configPath, src),
            dest,
            ansibleSSHConfig,
            false
        );
    }

}

module.exports = Bakerlet;