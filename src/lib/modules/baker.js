const Promise       = require('bluebird');
const child_process = Promise.promisifyAll(require('child_process'));
const conf          = require('./configstore');
const fs            = Promise.promisifyAll(require('fs-extra'));
const inquirer      = require('inquirer');
const mustache      = require('mustache');
const netaddr       = require('netaddr');
const path          = require('path');
const print         = require('./print');
const Provider      = require('../modules/providers/provider');
const spinner       = require('./Spinner');
const Ssh           = require('./ssh');
const Utils         = require('./utils/utils');
const vagrant       = Promise.promisifyAll(require('node-vagrant'));
const validator     = require('validator');
const yaml          = require('js-yaml');

const VagrantProvider = require('./providers/vagrant');
const DO_Provider     = require('./providers/digitalocean');
const Docker_Provider = require('./providers/docker');

// conf variables:
const spinnerDot = conf.get('spinnerDot');

const { configPath, ansible, boxes, bakeletsPath, remotesPath } = require('../../global-vars');

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

    async bake(scriptPath, ansibleSSHConfig, ansibleVM, verbose) {
        await this.provider.bake(scriptPath, ansibleSSHConfig, ansibleVM, verbose);
    }

    async list() {
        await this.provider.list();
    }

    async images(){
        await this.provider.images();
    }

    static async init() {
        let bakerYML = await fs.readFileAsync(path.join(configPath, './bakerTemplate.yml'), 'utf8');
        let dir = path.resolve(process.cwd());
        await fs.writeFileAsync('baker.yml', bakerYML, {encoding:'utf8'});
    }

    static async initBaker2() {
        let Baker = this;
        // TODO: Find a better approach to do this
        try{
            if(await fs.pathExists(await path.resolve(path.resolve(process.cwd(), 'baker.yml'))))
                await spinner.spinPromise(Promise.reject(), `A baker.yml already exists in current directory!`, spinnerDot);
        } catch (err) { return; }

        let vmResponse = await inquirer
            .prompt([
                {
                    type: 'input',
                    name: 'name',
                    message: 'Baker environment name:',
                    default: path.basename(process.cwd())
                },
                {
                    type: 'list',
                    name: 'memory',
                    message: 'Amount of memory to share with this environment (in MB):',
                    choices: ['512', '1024', '2048', '3072', '4096'],
                    default: '1024'
                },
                {
                    type: 'input',
                    name: 'ip',
                    message: 'IP to use for this VM: ',
                    validate: async function(ip) {
                        let pass = validator.isIP(ip);

                        var exists = await Utils.hostIsAccessible(ip);

                        if (pass && !exists) {
                            return true;
                        } else if (exists) {
                            return 'Another VM is using this IP, please enter a different IP address';
                        } else {
                            return 'This IP is not available, please enter a valid IP address';
                        }
                    }
                },
                {
                    type: 'input',
                    name: 'ports',
                    message: 'Forward ports comma separated, (GUEST:HOST) or (GUEST):',
                    validate: async function(value) {
                        if(value === '')
                            return true;

                        let ports = value.split(',').map(port => port.split(':'));
                        let invalidPorts = [];

                        ports.forEach(pp => {
                            pp.forEach(p => {
                                if(!validator.isPort(p.trim()))
                                    invalidPorts.push(p);
                            });
                        });

                        if (invalidPorts.length != 0) {
                            return `These ports are invalid, please enter valid ports: ${invalidPorts.join(' ')}`;
                        } else {
                            return true;
                        }
                    }
                },
                {
                    type: 'checkbox',
                    message: 'Select languages:',
                    name: 'langs',
                    choices: [
                        {
                            name: 'java8'
                        },
                        {
                            name: 'nodejs9'
                        },
                        {
                            name: 'R'
                        }
                    ]
                },
                {
                    type: 'checkbox',
                    message: 'Select services:',
                    name: 'services',
                    choices: [
                        {
                            name: 'docker'
                        },
                        {
                            name: 'mysql'
                        }
                    ]
                },
                {
                    type: 'checkbox',
                    message: 'Select tools:',
                    name: 'tools',
                    choices: [
                        {
                            name: 'ansible'
                        },
                        {
                            name: 'jupyter'
                        },
                        {
                            name: 'maven'
                        }
                    ]
                }
            ]);

        // TODO: refactor
        vmResponse.langs = vmResponse.langs.length ? {lang: vmResponse.langs} : false;
        vmResponse.services = vmResponse.services.length ? {service: vmResponse.services} : false;
        vmResponse.tools = vmResponse.tools.length ? {tool: vmResponse.tools} : false;

        let baker2Template = await fs.readFileAsync(path.join(configPath, './baker2Template.yml.mustache'), 'utf8');
        let bakerYML = mustache.render(baker2Template, vmResponse);
        let cwd = path.resolve(process.cwd());
        await fs.writeFileAsync(path.resolve(cwd, 'baker.yml'), bakerYML, {encoding:'utf8'});
        return;
    }

    /**
     * Checks if ansible server is up, if not it starts the server
     * It will also copy new vm's ansible script to ~/baker/{name}/ in ansible server
     */
    static async prepareAnsibleServer(bakerScriptPath) {
        let machine = vagrant.create({ cwd: ansible });
        let doc = yaml.safeLoad(await fs.readFileAsync(path.join(bakerScriptPath, 'baker.yml'), 'utf8'));

        try {
            // let bakerVMID = await VagrantProvider.getVagrantID('baker');
            // let state = await this.getState(bakerVMID);
            let state = await VagrantProvider.getState('baker');
            if (state === 'running') {
                let ansibleSSHConfig = await this.getSSHConfig(machine);
                await Ssh.copyFilesForAnsibleServer(bakerScriptPath, doc, ansibleSSHConfig);
                return machine;
            } else {
                try {
                    await machine.upAsync();
                    // machine.on('up-progress', function(data) {
                    //     print.info(data);
                    // });
                } catch (err) {
                    throw err;
                }
                let ansibleSSHConfig = await this.getSSHConfig(machine);

                await Ssh.copyFilesForAnsibleServer(bakerScriptPath, doc, ansibleSSHConfig);

                return machine;
            }
        } catch (err) {
            if (err === `Cannot find machine: baker`) {
                throw `Baker control machine is not installed. run \`baker setup\` to install control machine`;
            } else {
                throw err;
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
     * Make sure DockerVM exists
     * @param {String} custom name of the VM to be used as Docker host.
     *                          if undefined, usinig default Docker host.
     */
    static async prepareDockerVM(custom){
        if(!custom) {
            const dockerHostName = 'docker-srv';
            const dockerHostPath = path.join(boxes, dockerHostName);


            // console.log('dockerHostName', dockerHostName);
            // console.log('dockerHostPath', dockerHostPath)

            // preparing the ansibler server (needed for bakelets)
            // ansibleVM = await Baker.prepareAnsibleServer(bakePath); // need to ensure baker server is running?
            let ansibleVM = vagrant.create({ cwd: ansible });
            let ansibleSSHConfig = await Baker.getSSHConfig(ansibleVM);

            // ensure needed dir exist
            await Utils._ensureDir(boxes);
            await Utils._ensureDir(dockerHostPath);

            // always update vagrantfile
            let template = await fs.readFileAsync(path.join(configPath, './dockerHost/DockerVM.mustache'), 'utf8');
            let vagrantfile = mustache.render(template, {dockerHostName});
            await fs.writeFileAsync(path.join(dockerHostPath, 'Vagrantfile'), vagrantfile);

            let status;
            try{
                await VagrantProvider.getState('docker-srv')
                status = await VagrantProvider.getState('docker-srv');
            } catch(err){
                if (err == 'Cannot find machine: docker-srv') {
                    // Install baker-srv
                    await Utils._ensureDir(boxes);
                    await Utils._ensureDir(dockerHostPath);

                    await fs.copy(path.join(configPath, './dockerHost/dockerConfig.yml'), path.join(dockerHostPath, 'dockerConfig.yml'));
                    await fs.copy(path.join(configPath, './dockerHost/lxd-bridge'), path.join(dockerHostPath, 'lxd-bridge'));

                    await this.installDocker(ansibleSSHConfig);
                } else {
                    throw err;
                }
            }

            let machine = vagrant.create({ cwd: dockerHostPath });
            try {
                // TODO: Add a force reload option
                if(status != 'running'){
                    machine.on('up-progress', function(data) {
                        print.info(data);
                    });
                    await machine.upAsync();
                }
            } catch (err) {
                throw `Failed to start host VM: ${dockerHostName}\n${err}`;
            }
        } else {
            // TODO: custom docker hosts
            console.log('Docker-srv is running!')
        }
    }

    /**
     * Creates ansible server, if already doesn't exist
     */
    static async installAnsibleServer () {
        try {
            await fs.ensureDir(boxes);
            await fs.ensureDir(ansible);
        } catch (err) {
            throw err;
        }

        let machine = vagrant.create({ cwd: ansible });
        let bakerVMState;

        try {
            bakerVMState = await VagrantProvider.getState('baker');
            if(bakerVMState == 'running') return;
        } catch (err) {
            if (err === `Cannot find machine: baker`) {
                let template = await fs.readFileAsync(path.join(configPath, './AnsibleVM.mustache'), 'utf8');
                let vagrantfile = mustache.render(template, require('../../config/AnsibleVM'));
                await fs.writeFileAsync(path.join(ansible, 'Vagrantfile'), vagrantfile)

                await fs.copy(
                    path.resolve(configPath, './provision.shell.sh'),
                    path.resolve(ansible, 'provision.shell.sh')
                );
            } else {
                throw err;
            }
        }

        try {
            await machine.upAsync();
        } catch (err) {
            throw `Failed to start Baker control machine`;
        }

        // machine.on('up-progress', function(data) {
        //     print.info(data);
        // });

        return;
    }

    /**
     * Re-installs ansible server.
     * @returns Promise
     */
    static async reinstallAnsibleServer () {
        try {
            await VagrantProvider.delete('baker');
        } catch (err) {
            if (err != `Cannot find machine: baker`) {
                throw err;
            }
        }
        await this.installAnsibleServer();
        return;
    }

    // TODO: move to provider
    /**
     * Get ssh configurations
     * @param {Obj} machine
     * @param {Obj} nodeName Optionally give name of machine when multiple machines declared in single Vagrantfile.
     */
    static async getSSHConfig (machine, nodeName) {
        try {
            let sshConfig = await machine.sshConfigAsync();
            if(sshConfig && sshConfig.length > 0){

                if( nodeName )
                {
                    for( var i = 0; i < sshConfig.length; i++ )
                    {
                        if( sshConfig[i].host === nodeName )
                           return sshConfig[i];
                    }
                }
                return sshConfig[0];
            } else{
                throw '';
            }
        } catch (err) {
            throw `Couldn't get private ssh key of machine ${err}`;
        }
    }

    // also in provider.vagrant
    /**
     * Adds the host url to /etc/hosts
     *
     * @param {String} ip
     * @param {String} name
     * @param {Object} sshConfig
     */
    static async addToAnsibleHosts (ip, name, ansibleSSHConfig, vmSSHConfig){
        // TODO: Consider also specifying ansible_connection=${} to support containers etc.
        // TODO: Callers of this can be refactored to into two methods, below:
        return Ssh.sshExec(`echo "[${name}]\n${ip}\tansible_ssh_private_key_file=${ip}_rsa\tansible_user=${vmSSHConfig.user}" > /home/vagrant/baker/${name}/baker_inventory && ansible all -i "localhost," -m lineinfile -a "dest=/etc/hosts line='${ip} ${name}' state=present" -c local --become`, ansibleSSHConfig);
    }

    /**
     * Adds cluster to baker_inventory
     *
     * @param {List} nodeList, list of nodes (ip address, user) to add to baker_inventory
     * @param {String} name
     * @param {Object} sshConfig
     */
    static async addClusterToBakerInventory (nodeList, name, sshConfig, usePython3){
        let hosts = [];
        let pythonPath = usePython3 ? '/usr/bin/python3' : '/usr/bin/python';
        if( usePython3 )

        for( var i=0; i < nodeList.length; i++ )
        {
            var {ip, user} = nodeList[i];
            hosts.push( `${ip}\tansible_ssh_private_key_file=${ip}_rsa\tansible_user=${user}\tansible_python_interpreter=${pythonPath}` );
        }

        await Ssh.sshExec(`echo "[${name}]\n${hosts.join('\n')}" > /home/vagrant/baker/${name}/baker_inventory`, sshConfig);
    }

    /**
     * Adds the host url to /etc/hosts (without adding anything to inventory)
     *
     * @param {String} ip
     * @param {String} name
     * @param {Object} sshConfig
     */
    static async addIpToAnsibleHosts (ip, name, sshConfig){
        // TODO: check addToAnsibleHosts(), looks like that is doing the same thing too
        return Ssh.sshExec(`ansible all -i "localhost," -m lineinfile -a "dest=/etc/hosts line='${ip} ${name}' state=present" -c local --become`, sshConfig);
    }

    // TODO: Temp: refactor to be able to use the docker bakelet instead
    static async installDocker(sshConfig) {
        return Ssh.sshExec(`cd /home/vagrant/baker/ && ansible-playbook -i "localhost," installDocker.yml -c local`, sshConfig, false);
    }

    static async runAnsibleVault (doc, pass, dest, ansibleSSHConfig) {
        return new Promise( async (resolve, reject) => {
            let key = doc.bake.vault.checkout.key;
            await Ssh.sshExec(`cd /home/vagrant/baker/${doc.name} && echo "${pass}" > vault-pwd`, ansibleSSHConfig);
            await Ssh.sshExec(`cd /home/vagrant/baker/${doc.name} && ansible-playbook -e "vault=${doc.name}/baker-vault.yml key=${key} dest=${dest}" -i baker_inventory --vault-password-file=vault-pwd ../CheckoutFromVault.yml`, ansibleSSHConfig)
            //await sshExec(`cd /home/vagrant/baker/${doc.name} && echo "${pass}" > vault-pwd &&  ansible-vault view baker-vault.yml --vault-password-file=vault-pwd > checkout.key`, sshConfig);
            //await sshExec(`cd /home/vagrant/baker/${doc.name} && ansible all -i baker_inventory --private-key id_rsa -u ${vmSSHConfigUser.user} -m copy -a "src=checkout.key dest=${dest} mode=0600"`, sshConfig)
            await Ssh.sshExec(`cd /home/vagrant/baker/${doc.name} && rm vault-pwd`, ansibleSSHConfig)
            resolve();
        });
    }

    // TODO: Need to be cleaning cmd so they don't do things like
    // ; sudo rm -rf / on our server...
    static async runAnsiblePlaybook (doc, cmd, ansibleSSHConfig, verbose, variables) {
        let flatVars = {};
        for( var i =0; i < variables.length; i++ )
        {
            for( var key in variables[i] )
            {
                flatVars[key] = variables[i][key];
            }
        }
        let extravars = JSON.stringify(flatVars);
        //let extravars = yaml.dump(variables);
        if( verbose ) console.log( extravars );
        // return Ssh.sshExec(`export ANSIBLE_HOST_KEY_CHECKING=false && cd /home/vagrant/baker/${doc.name} && ansible all -m ping -i baker_inventory`, ansibleSSHConfig, verbose);
        return Ssh.sshExec(`export ANSIBLE_HOST_KEY_CHECKING=false && cd /home/vagrant/baker/${doc.name} && echo '${extravars}' > playbook.args.json && ansible-playbook -e @playbook.args.json -i baker_inventory ${cmd}; rm -f playbook.args.json`, ansibleSSHConfig, verbose);
    }

    static async runGitClone (doc, repo, dest, ansibleSSHConfig,verbose) {
        return Ssh.sshExec(`export ANSIBLE_HOST_KEY_CHECKING=false && cd /home/vagrant/baker/${doc.name} && ansible all -m git -a "repo=${repo} dest=${dest} version=HEAD" -i baker_inventory`, ansibleSSHConfig, verbose);
    }

    static async runAnsibleAptInstall (doc, cmd, ansibleSSHConfig,verbose) {
        return Ssh.sshExec(`export ANSIBLE_HOST_KEY_CHECKING=false && cd /home/vagrant/baker/${doc.name} && ansible all -m apt -a "pkg=${cmd} update_cache=yes cache_valid_time=86400" -i baker_inventory --become`, ansibleSSHConfig, verbose);
    }

    static async runAnsiblePipInstall (doc, requirements, ansibleSSHConfig, verbose) {
        return Ssh.sshExec(`export ANSIBLE_HOST_KEY_CHECKING=false && cd /home/vagrant/baker/${doc.name} && ansible all -m pip -a "requirements=${requirements}" -i baker_inventory --become`, ansibleSSHConfig, verbose);
    }

    static async runAnsibleNpmInstall (doc, packagejson, ansibleSSHConfig, verbose) {
        return Ssh.sshExec(`export ANSIBLE_HOST_KEY_CHECKING=false && cd /home/vagrant/baker/${doc.name} && ansible all -m npm -a "path=${packagejson}" -i baker_inventory`, ansibleSSHConfig, verbose);
    }

    static async runAnsibleTemplateCmd (doc, src, dest, variables, ansibleSSHConfig, verbose) {
        let flatVars = {};
        for( var i =0; i < variables.length; i++ )
        {
            for( var key in variables[i] )
            {
                flatVars[key] = variables[i][key];
            }
        }
        let extravars = JSON.stringify(flatVars);
        //let extravars = yaml.dump(variables);
        return Ssh.sshExec(`export ANSIBLE_HOST_KEY_CHECKING=false && cd /home/vagrant/baker/${doc.name} && echo '${extravars}' > template.args.json && ansible all -m template -a "src=${src} dest=${dest}" -e @template.args.json -i baker_inventory; rm -f template.args.json`, ansibleSSHConfig, verbose);
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

    static async bakeRemote (ansibleSSHConfig, remoteIP, remoteKey, remoteUser, scriptPath, verbose) {
        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));
        let vmSSHConfig = {
            user: remoteUser,
            private_key: remoteKey,
            ip: remoteIP,
            hostname: remoteIP,
            port: 22
        }

        try {
            // TODO: copy the ssh key to ${ip}_rsa instead of id_rsa
            await Ssh.copyFromHostToVM(
                vmSSHConfig.private_key,
                `/home/vagrant/baker/${doc.name}/${vmSSHConfig.ip}_rsa`,
                ansibleSSHConfig
            );
            await this.addToAnsibleHosts(vmSSHConfig.ip, doc.name + '-cloud', ansibleSSHConfig, vmSSHConfig);
            await this.provider.setKnownHosts(vmSSHConfig.ip, ansibleSSHConfig);
            await this.provider.mkTemplatesDir(doc, ansibleSSHConfig);

            // prompt for passwords
            if( doc.vars ) {
                await Utils.traverse(doc.vars);
            }

            // Installing stuff.
            let resolveB = require('../bakelets/resolve');
            await resolveB.resolveBakelet(bakeletsPath, remotesPath, doc, scriptPath, verbose);

        } catch (err) {
            throw err;
        }
    }

    static async cluster (ansibleSSHConfig, ansibleVM, scriptPath, verbose) {
        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));

        // prompt for passwords
        if( doc.vars )
        {
            await Utils.traverse(doc.vars);
        }

        let getClusterLength = function (baseName,cluster)
        {
            // Default is 4.
            let name = baseName;
            let length = 4;
            //let cluster = {"nodes [3]": []};
            let regex = new RegExp(`^${baseName}\\s*\\[(\\d+)\\]`, "i");
            for(var k in cluster )
            {
                let m = k.match(regex);
                // console.log( m );
                if (m) {
                    name = m[0];
                    length = m[1];
                    break;
                }
            }
            return {nameProperty: name, length: length};
        }


        let cluster = {}
        let nodeDoc = {};

        if( doc.cluster && doc.cluster.plain )
        {
            cluster.cluster = {};
            cluster.cluster.nodes = [];

            let {nameProperty, length} = getClusterLength("nodes", doc.cluster.plain );
            nodeDoc = doc.cluster.plain[nameProperty];
            nodeDoc.name = doc.name;

            // Get base ip or assign default cluster ip
            let baseIp = doc.cluster.plain[nameProperty].ip || '192.168.20.2';
            let Addr = netaddr.Addr;

            for( var i = 0; i < length; i++ )
            {
                // Create a copy from yaml
                let instance = Object.assign({}, doc.cluster.plain[nameProperty]);
                instance.name = `${doc.name.replace(/-/g,'')}${parseInt(i)+1}`;

                instance.ip = baseIp;
                // Set to next ip address, skipping prefix.
                baseIp = Addr(baseIp).increment().octets.join(".");

                instance.memory = instance.memory || 1024;
                instance.cpus   = instance.cpus || 1;


                cluster.cluster.nodes.push( instance );
            }
        }

        await this.provider.mkTemplatesDir(doc, ansibleSSHConfig);

        let provider = null;
        let dir = path.join(boxes, doc.name);
        try {
            await fs.ensureDir(dir);
        } catch (err) {
            throw `Creating directory failed: ${dir}`;
        }

        if( doc.provider && doc.provider === "digitalocean")
        {
            provider = new DO_Provider(process.env.DOTOKEN, dir);
            for( let node of cluster.cluster.nodes )
            {
                console.log(`Provisioning ${node.name} in digitalocean`);
                let droplet = await provider.create(node.name);
            }
        }
        else
        {
            let template = await fs.readFile(path.join(configPath, './ClusterVM.mustache'), 'utf8');
            provider = new VagrantProvider(dir);

            const output = mustache.render(template, cluster);
            await fs.writeFileAsync(path.join(dir, 'Vagrantfile'), output);

            let machine = vagrant.create({ cwd: dir });

            machine.on('up-progress', function(data) {
                //console.log(machine, progress, rate, remaining);
                if( verbose ) print.info(data);
            });

            await spinner.spinPromise(machine.upAsync(), `Provisioning cluster in VirtualBox`, spinnerDot);

        }



        let nodeList = [];
        //_.pluck(cluster.cluster.nodes, "ip");
        for( var i = 0; i < cluster.cluster.nodes.length; i++ )
        {
            let node = cluster.cluster.nodes[i];
            let vmSSHConfig = await provider.getSSHConfig(node.name);

            let ip = node.ip;
            if( doc.provider && doc.provider === "digitalocean" )
            {
                ip = vmSSHConfig.hostname;
            }

            nodeList.push({
                ip: ip,
                user: vmSSHConfig.user
            });

            await Ssh.copyFromHostToVM(
                vmSSHConfig.private_key,
                `/home/vagrant/baker/${doc.name}/${ip}_rsa`,
                ansibleSSHConfig
            );
            await this.provider.setKnownHosts(ip, ansibleSSHConfig);
            await this.addIpToAnsibleHosts(ip, node.name, ansibleSSHConfig);

            console.log( `${nodeList[i].ip} ${nodeList[i].user} ${vmSSHConfig.private_key}`);
        }
        if( doc.provider && doc.provider === "digitalocean" )
        {
            await this.addClusterToBakerInventory(nodeList, doc.name, ansibleSSHConfig, true);
        }
        else{
            await this.addClusterToBakerInventory(nodeList, doc.name, ansibleSSHConfig, false);
        }

        let resolveB = require('../bakelets/resolve');
        nodeDoc.vars = doc.vars;
        await resolveB.resolveBakelet(bakeletsPath, remotesPath, nodeDoc, scriptPath, verbose);

    }

}

module.exports = Baker;
