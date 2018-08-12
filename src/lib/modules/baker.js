const fs            = require('fs-extra');
const path          = require('path');
const yaml          = require('js-yaml');
const os            = require('os');

const Ssh           =      require('./ssh');
const Provider           = require('./providers/provider');
const VagrantProvider    = require('./providers/vagrant');
const VirtualBoxProvider = require('./providers/virtualbox');
const DockerProvider     = require('./providers/docker');
const DO_Provider        = require('./providers/digitalocean');
const RemoteProvider     = require('./providers/remote');
const RuncProvider       = require('./providers/runc');


// conf variables:
// const spinnerDot = conf.get('spinnerDot');

const { configPath, bakerSSHConfig } = require('../../global-vars');

class Baker {
    /**
     *
     * @param {Provider} provider
     */
    constructor(provider) {
        this.provider = provider;
    }

    async ssh(name) {
        await this.provider.ssh(name);
    }

    async start(name, verbose) {
        await this.provider.start(name, verbose);
    }

    async stop(name, force) {
        await this.provider.stop(name, force);
    }

    async delete(name) {
        await this.provider.delete(name);
    }

    async bake(scriptPath, ansibleSSHConfig, verbose) {
        await this.provider.bake(scriptPath, ansibleSSHConfig, verbose);
    }

    static async list() {
        await new VirtualBoxProvider().list();
        await new RuncProvider().list();
    }

    async images(){
        await this.provider.images();
    }

    static async init() {
        let bakerYML = await fs.readFile(path.join(configPath, './bakerTemplate.yml'), 'utf8');
        let dir = path.resolve(process.cwd());
        await fs.writeFile('baker.yml', bakerYML, {encoding:'utf8'});
    }

    /**
     * detects the type of environment.
     * Helper function for commands to automatically create the right provider object.
     * @param {String} bakePath path to the baker.yml file
     */
    static async chooseProvider(bakePath, usePersistent, useVM){
        let doc = yaml.safeLoad(await fs.readFile(path.join(bakePath, 'baker.yml'), 'utf8'));
        let envName = doc.name;
        let envType = doc.container ? 'container' : doc.vm || doc.vagrant ? 'vm' : doc.remote ? 'remote' : doc.persistent ? 'persistent' : 'other';

        let provider = null;
        if(envType === 'container')
            provider = new DockerProvider({host: '192.168.252.251', port: '2375', protocol: 'http'});
        else if(envType === 'vm')
            //provider = new VagrantProvider();
            provider = new VirtualBoxProvider();
        else if(envType === 'persistent')
        {
            provider = new RuncProvider();
        }
        else if(envType === 'remote'){
            if(!RemoteProvider.validateBakerYML(bakePath)){
                console.error('invalid baker.yml for remote provider');
                process.exit(1);
            }
            else
                provider = new RemoteProvider(doc.remote.user, doc.remote.private_key, doc.remote.ip, doc.remote.port);
        }
        else
            console.error('This command only supports VM and container environments');

        // Override ...for debugging... testing
        if( usePersistent )
        {
            provider = new RuncProvider();
        }
        if( useVM )
        {
            provider = new VirtualBoxProvider();
        }


        let BakerObj = new Baker(provider);

        return {envName, provider, BakerObj};
    }

    // TODO this shows we need a better handle on how we interact with our control servers.
    async exposePorts(bakePath, verbose)
    {
        let doc = yaml.safeLoad(await fs.readFile(bakePath, 'utf8'));

        let portsRoot = doc.vm ? doc.vm.ports : doc.persistent ? doc.persistent.ports : null;
        if( !portsRoot )
            return;

        // ports: '8000, 9000,  1000:3000'
        let ports = portsRoot.toString().trim().split(/\s*,\s*/g);
        if( this.provider instanceof VirtualBoxProvider )
        {
            const VBoxProvider = require('node-virtualbox/lib/VBoxProvider');
            let driver = new VBoxProvider();
            for( var port of ports  )
            {
                await driver.expose(doc.name, port, verbose);
            }
        }
        else if( this.provider instanceof RuncProvider )
        {
            if( os.platform() == 'win32' )
            {
                const VBoxProvider = require('node-virtualbox/lib/VBoxProvider');
                let driver = new VBoxProvider();

                // Do vbox stuff on server
                for( var port of ports  )
                {
                    await driver.expose("baker-srv", port, verbose);
                }
            }
            else
            {
                // Launch ssh command with internal expose port command
                for( var port of ports  )
                {
                    let a = port.trim().split(/\s*:\s*/g);
                    let guest = a[0];
                    let host  = a[1] || a[0]; // if undefined use same as guest port for host port.
                    let cmd = `nohup /usr/bin/vpnkit-expose-port -proto tcp -host-ip 0.0.0.0 -host-port ${host} -container-ip 127.0.0.1 -container-port ${guest} -no-local-ip -i > /dev/null 2>&1 &`
                    // Simple command for debugging:
                    //let cmd = `nohup yes `;
                    let code = await Ssh.sshExecBackground(cmd, bakerSSHConfig, verbose);
                    if( verbose )
                    {
                        // If port is already exposed, then will gracefully fail
                        // Baker# /usr/bin/vpnkit-expose-port -proto tcp -host-ip 0.0.0.0 -host-port 8080 -container-ip 127.0.0.1 -container-port 8080 -no-local-ip -i
                        // 2018/08/12 18:03:48 exposePort tcp:0.0.0.0:8080:tcp:127.0.0.1:8080
                        // 2018/08/12 18:03:48 Failed to mkdir /port/tcp:0.0.0.0:8080:tcp:127.0.0.1:8080: &os.PathError{Op:"mkdir", Path:"/port/tcp:0.0.0.0:8080:tcp:127.0.0.1:8080", Err:0x11}
                        // 2018/08/12 18:03:48 Failed to set up proxymkdir /port/tcp:0.0.0.0:8080:tcp:127.0.0.1:8080: file exists
                        // Exit Code 1: 
                        console.log( `Expose port ${host}:${guest} - Exit code: ${code}` );
                    }
                }
                // throw new Error("debugging.");
            }
        }
    }

    static async getCWDBakerYML(){
        let cwd = path.resolve(process.cwd());
        let bakePath = path.resolve(cwd, 'baker.yml')
        if(await fs.pathExists(bakePath)){
            let bakerYML = yaml.safeLoad(await fs.readFile(bakePath, 'utf8'));
            bakerYML.cwd = cwd;
            return bakerYML;
        } else{
            return undefined;
        }
    }

    /**
     * Get ssh configurations
     * @param {Obj} machine
     * @param {Obj} nodeName Optionally give name of machine when multiple machines declared in single Vagrantfile.
     */
    static async getSSHConfig (machine, nodeName) {
        this.provider.getSSHConfig(machine, nodeName);
    }

    static async info (envName, provider, verbose) {

        if( provider === 'digitalocean')
        {
            //console.log(envName, provider, verbose);
            let token = process.env.DOTOKEN;
            let dir = path.join(require('os').homedir(), '.baker', envName);

            let do_provider = new DO_Provider(token, dir);
            let nodes = await do_provider.info();
            console.log( JSON.stringify(nodes) );
        }
        else
        {
            console.log( JSON.stringify((await VagrantProvider.retrieveSSHConfigByName(envName) )));
        }

        return;
    }

}

module.exports = Baker;
