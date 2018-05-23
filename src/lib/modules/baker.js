const Promise       = require('bluebird');
const _             = require('underscore');
const child_process = Promise.promisifyAll(require('child_process'));
const fs            = Promise.promisifyAll(require('fs-extra'));
const inquirer      = require('inquirer');
const mustache      = require('mustache');
const netaddr       = require('netaddr');
const path          = require('path');
const print         = require('./print');
const ping          = require('ping')
const prompt        = require('prompt');
const slash         = require('slash');
const spinner       = require('./Spinner');
const Ssh           = require('./ssh');
const vagrant       = Promise.promisifyAll(require('node-vagrant'));
const validator     = require('validator');
const yaml          = require('js-yaml');

const VagrantProvider = require('./providers/vagrant');
const DO_Provider     = require('./providers/digitalocean');
const Docker_Provider = require('./providers/docker');

const { spinnerDot, configPath, ansible, boxes, bakeletsPath, remotesPath } = require('../../global-vars');

class Baker {
    constructor() {
    }

    static async hostIsAccessible(host) {
        return (await ping.promise.probe(host, {extra: ['-i 2']})).alive;
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

                        var exists = await Baker.hostIsAccessible(ip);

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
     * get State of a vagrant vm by id.
     * @param {String} id
     */
    static async getState(id) {
        try {
            let VMs = await vagrant.globalStatusAsync();
            let VM = VMs.filter(VM => VM.id == id)[0];
            if(!VM)
                throw  `Cannot find machine: ${id}`;
            return VM.state;
        } catch (err) {
            throw err;
        }
    }

    /**
     * get vagrant id of VMs by name
     */
    static async getVagrantIDByName(VMName) {
        let VMs = await vagrant.globalStatusAsync();
        let VM = VMs.filter(VM => VM.name == VMName)[0];

        if(!VM)
            throw  `Cannot find machine: ${VMName}`;
        return VM.id;
    }

    /**
     * It will ssh to the vagrant box
     * @param {String} name
     */
    static async bakerSSH (name) {
        try {
            let id = await this.getVagrantIDByName(name);
            try {
                child_process.execSync(`vagrant ssh ${id}`, {stdio: ['inherit', 'inherit', 'ignore']});
            } catch (err) {
                throw `VM must be running to open SSH connection. Run \`baker status\` to check status of your VMs.`
            }
        } catch(err) {
            throw err;
        }
    }


    /**
     * Checks if ansible server is up, if not it starts the server
     * It will also copy new vm's ansible script to ~/baker/{name}/ in ansible server
     */
    static async prepareAnsibleServer (bakerScriptPath) {
        let machine = vagrant.create({ cwd: ansible });
        let doc = yaml.safeLoad(await fs.readFileAsync(path.join(bakerScriptPath, 'baker.yml'), 'utf8'));

        try {
            let bakerVMID = await this.getVagrantIDByName('baker');
            let state = await this.getState(bakerVMID);
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

    /**
     * Private function
     * Returns the path of the VM, undefined if VM doesn't exist
     * @param {String} VMName
     */
    static async getVMPath(VMName){
        let VMs = await vagrant.globalStatusAsync();
        let VM = VMs.find(VM => VM.name === VMName);

        if(VM)
            return VM.cwd;
        else
            throw `Cannot find machine: ${VMName}`;
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
     * Destroy VM
     * @param {String} VMName
     */
    static async destroyVM (VMName) {
        try {
            let VMPath = await this.getVMPath(VMName);
            let machine = vagrant.create({ cwd: VMPath });

            try {
                await machine.destroyAsync();
            } catch (err){
                throw `Failed to destroy machine ${VMName}`;
            }
        } catch (err) {
            throw err;
        }

        return;
    }

    /**
     * Prune
     */
    static async prune() {
        try {
            await vagrant.globalStatusAsync('--prune');
            await this.status();
            return;
        } catch (err) {
            throw err;
        }
    }

    /**
     * Shut down VM
     * @param {String} id
     */
    static async haltVM (VMName, force=false) {
        try {
            let VMPath = await this.getVMPath(VMName);
            let machine = vagrant.create({ cwd: VMPath });

            try {
                await machine.haltAsync();
            } catch (err){
                throw `Failed to shutdown machine ${VMName}`;
            }
        } catch (err) {
            throw err;
        }

        return;
    }

    /**
     * Start VM
     * @param {String} name
     */
    static async upVM (VMName) {
        try {
            let VMPath = await this.getVMPath(VMName);
            let machine = vagrant.create({ cwd: VMPath });
            try {
                await machine.upAsync();
            } catch (err){
                throw `Failed to start machine ${VMName}`;
            }
        } catch (err){
            throw err;
        }

        return;
    }

    // TODO: This shouldn't have to be static
    static async _ensureDir(path){
        try {
            await fs.ensureDir(path);
        } catch (err) {
            throw `could not create directory: ${path} \n${err}`;
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

            await this.installDocker(ansibleSSHConfig);

            // ensure needed dir exist
            await this._ensureDir(boxes);
            await this._ensureDir(dockerHostPath);

            // always update vagrantfile
            let template = await fs.readFileAsync(path.join(configPath, './dockerHost/DockerVM.mustache'), 'utf8');
            let vagrantfile = mustache.render(template, {dockerHostName});
            await fs.writeFileAsync(path.join(dockerHostPath, 'Vagrantfile'), vagrantfile);

            let status;
            try{
                await this.getVMPath('docker-srv')
                status = await this.getState(await this.getVagrantIDByName('docker-srv'));
            } catch(err){
                if (err == 'Cannot find machine: docker-srv') {
                    // Install baker-srv
                    await this._ensureDir(boxes);
                    await this._ensureDir(dockerHostPath);

                    await fs.copy(path.join(configPath, './dockerHost/dockerConfig.yml'), path.join(dockerHostPath, 'dockerConfig.yml'));
                    await fs.copy(path.join(configPath, './dockerHost/lxd-bridge'), path.join(dockerHostPath, 'lxd-bridge'));

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
        let bakerVMID;
        let bakerVMState;

        try {
            bakerVMID = await this.getVagrantIDByName('baker');
            bakerVMState = await this.getState(bakerVMID);
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
            await this.destroyVM('baker');
        } catch (err) {
            if (err != `Cannot find machine: baker`) {
                throw err;
            }
        }
        await this.installAnsibleServer();
        return;
    }

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
     * Adds the host url to /etc/hosts
     *
     * @param {String} ip
     * @param {String} name
     * @param {Object} sshConfig
     */
    static async addToAnsibleHostsDocker (name, ansibleSSHConfig, user){
        // TODO: Consider also specifying ansible_connection=${} to support containers etc.
        // TODO: Callers of this can be refactored to into two methods, below:
        // return Ssh.sshExec(`mkdir -p /home/vagrant/baker/${name}/ && echo "${name}\tansible_connection=docker\tansible_user=${user}" > /home/vagrant/baker/${name}/baker_inventory && ansible all -i /home/vagrant/baker/${name}/baker_inventory -m lineinfile -a 'dest=/etc/environments line="DOCKER_HOST=tcp://192.168.252.251:2375"'`, ansibleSSHConfig);
        return Ssh.sshExec(`mkdir -p /home/vagrant/baker/${name}/ && echo "${name}\tansible_connection=docker\tansible_user=${user}" > /home/vagrant/baker/${name}/baker_inventory && ansible all  -i "localhost," -m lineinfile -a 'dest=/etc/environment line="DOCKER_HOST=tcp://192.168.252.251:2375"' -c local --become`, ansibleSSHConfig);
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

    static async retrieveSSHConfigByName (name) {
        let dir = path.join(boxes, name);
        let vm = vagrant.create({ cwd: dir });
        let vmSSHConfigUser = await this.getSSHConfig(vm);

        return vmSSHConfigUser;
    }

    static async setKnownHosts (ip, sshConfig) {
        return Ssh.sshExec(`cd /home/vagrant/baker/ && ansible-playbook -i "localhost," registerhost.yml -e "ip=${ip}" -c local`, sshConfig);
    }

    // TODO: Temp: refactor to be able to use the docker bakelet instead
    static async installDocker(sshConfig) {
        return Ssh.sshExec(`cd /home/vagrant/baker/ && ansible-playbook -i "localhost," installDocker.yml -c local`, sshConfig, false);
    }

    static async runDockerBootstrap(sshConfig, containerName) {
        return Ssh.sshExec(`cd /home/vagrant/baker/ && ansible-playbook -i ./${containerName}/baker_inventory dockerBootstrap.yml`, sshConfig, true);
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

    static async mkTemplatesDir (doc, ansibleSSHConfig) {
        return Ssh.sshExec(`mkdir -p /home/vagrant/baker/${doc.name}/templates`, ansibleSSHConfig);
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

    static async promptValue (propertyName, description, hidden=false) {
        return new Promise((resolve, reject) => {
            prompt.start();
            prompt.get([{ name: propertyName, description: description, hidden:hidden }], function(
                err,
                result
            ) {
                if (err) {
                    print.error(err);
                }
                //prompt.stop();
                resolve(result[propertyName]);
            });
        });
    }

    /**
     * Private function:
     * Traverse yaml and do prompts
     */
    static async traverse(o) {
        const stack = [{ obj: o, parent: null, parentKey: '' }];

        while (stack.length) {
            const s = stack.shift();
            const obj = s.obj;
            const parent = s.parent;
            const parentKey = s.parentKey;

            for (var i = 0; i < Object.keys(obj).length; i++) {
                let key = Object.keys(obj)[i];

                //await fn(key, obj[key], obj)

                if (obj[key] instanceof Object) {
                    stack.unshift({ obj: obj[key], parent: obj, parentKey: key });
                }

                if (key == 'prompt') {
                    const input = await this.promptValue(parentKey, obj[key]);
                    // Replace "prompt" with an value provided by user.
                    parent[parentKey] = input;
                }
            }
        }
        return o;
    }

    static async initVagrantFile (vagrantFilePath, doc, template, scriptPath) {
        if (doc.vm ) {
            doc.vagrant = doc.vm;
            delete doc.vm;
        }
        const vagrant = doc.vagrant;
        await this.traverse(vagrant);
        // Defaults
        // vagrant.box = vagrant.box || "ubuntu/xenial64"
        // TODO: Cleanup this mess
        if (vagrant.box && (await this.boxes()).map(e=>e.name).includes(`${vagrant.box}.baker`)){
            vagrant.box = vagrant.box + '.baker';
        }
        else if(vagrant.box && (await this.boxes()).map(e=>e.name).includes(`${vagrant.box}`)){
            vagrant.box = vagrant.box;
        }
        else{
            vagrant.box = "ubuntu/xenial64";
        }
        vagrant.memory = vagrant.memory || "1024"

        // Adaptor pattern: Support baker2 and baker format
        let network = doc.vagrant.network || [];
        if( vagrant.ip )
        {
            network = [...network, ...[{private_network: {ip: vagrant.ip}}]];
        }
        if( vagrant.ports )
        {
            // ports: '8000, 9000,  1000:3000'
            let ports = vagrant.ports.toString().trim().split(/\s*,\s*/g);
            for( var port of ports  )
            {
                let a = port.trim().split(/\s*:\s*/g);
                let guest = a[0];
                let host  = a[1] || a[0]; // if undefined use same as guest port for host port.
                network = [...network, ...[{forwarded_port: {guest: guest, host: host}}]];
            }
        }
        vagrant.network = network;

        let syncFolders = doc.vagrant.synced_folders || [];
        doc.vagrant.synced_folders = [...syncFolders, ...[{folder : {src: slash(scriptPath), dest: `/${path.basename(scriptPath)}`}}]];
        const output = mustache.render(template, doc);
        await fs.writeFileAsync(vagrantFilePath, output);
    }

    static async status () {
        try {
            let VMs = await vagrant.globalStatusAsync();
            // Only showing baker VMs
            VMs = VMs.filter(VM => VM.cwd.includes('.baker/'));
            console.table('\nBaker status: ', VMs);
        } catch (err) {
            throw err
        }

        return;
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
            console.log( JSON.stringify((await Baker.retrieveSSHConfigByName(envName) )));
        }

        return;
    }

    static async listDocker() {
        const dockerProvider = new Docker_Provider({host: '192.168.252.251', port: '2375', protocol: 'http'});
        return await dockerProvider.info();
    }

    static async startDocker(scriptPath, ansibleSSHConfig) {
        // Make sure Docker VM is running
        await spinner.spinPromise(this.prepareDockerVM(), `Preparing Docker host`, spinnerDot);

        // Installing Docker
        // let resolveB = require('../bakelets/resolve');
        // await resolveB.resolveBakelet(bakeletsPath, remotesPath, doc, scriptPath, verbose)

        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));

        const dockerProvider = new Docker_Provider({host: '192.168.252.251', port: '2375', protocol: 'http'});
        let image = doc.image || 'ubuntu:latest'
        await dockerProvider.pull(image);

        // Check if a contaienr with this name exists and do something based on its state
        // let existingContainers = await dockerProvider.info();
        // let sameNameContainer = existingContainers.filter(c => c.name == doc.name)[0];
        // if (sameNameContainer && sameNameContainer.state == 'stopped') {
        // }
        try {
            let sameNameContainer = await dockerProvider.info(doc.name);
            if(sameNameContainer.state == 'stopped')
                await dockerProvider.remove(doc.name);
            else
                throw  `the container name ${doc.name} is already in use by another running container.`

        } catch (error) {
            if(error != `container doesn't exist: ${doc.name}`)
                throw error;
        }

        let container = await dockerProvider.init(image, [], doc.name, doc.ip, scriptPath);
        await dockerProvider.startContainer(container);

        // TODO: root is hard coded
        await this.addToAnsibleHostsDocker(doc.name, ansibleSSHConfig, 'root')

        // prompt for passwords
        if( doc.vars ) {
            await this.traverse(doc.vars);
        }

        // let vmSSHConfig = await this.getSSHConfig(machine);
    }

    static async bakeDocker(scriptPath, ansibleSSHConfig) {
        // Start the container
        await this.startDocker(scriptPath, ansibleSSHConfig);

        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));

        // run dockerBootstrap.yml
        // TODO:
        await this.runDockerBootstrap(ansibleSSHConfig, doc.name);

        // Installing stuff
        let resolveB = require('../bakelets/resolve');
        await resolveB.resolveBakelet(bakeletsPath, remotesPath, doc, scriptPath, true);
    }

    static async stopDocker(scriptPath) {
        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));
        const dockerProvider = new Docker_Provider({host: '192.168.252.251', port: '2375', protocol: 'http'});
        await dockerProvider.stop(doc.name);
    }

    static async removeDocker(scriptPath) {
        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));
        const dockerProvider = new Docker_Provider({host: '192.168.252.251', port: '2375', protocol: 'http'});
        await dockerProvider.remove(doc.name);
    }

    /**
     * ssh to docker container
     * @param {String} scriptPath path to the baker.yml file
     */
    static async SSHDocker (scriptPath) {
        try {
            let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));

            const dockerHostName = 'docker-srv';
            const dockerHostPath = path.join(boxes, dockerHostName);
            let machine = vagrant.create({ cwd: dockerHostPath });
            let privateKeyPath = (await this.getSSHConfig(machine)).private_key;

            try {
                child_process.execSync(`ssh -tt -i ${privateKeyPath} vagrant@192.168.252.251 docker exec -it ${doc.name} /bin/bash`, {stdio: ['inherit', 'inherit', 'ignore']});

            } catch (err) {
                // throw `VM must be running to open SSH connection. Run \`baker status\` to check status of your VMs.`
            }
        } catch(err) {
            throw err;
        }
    }

    static async bake (ansibleSSHConfig, ansibleVM, scriptPath) {
        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));

        let dir = path.join(boxes, doc.name);
        let template = await fs.readFile(path.join(configPath, './BaseVM.mustache'), 'utf8');

        try {
            await fs.ensureDir(dir);
        } catch (err) {
            throw `Creating directory failed: ${dir}`;
        }

        let machine = vagrant.create({ cwd: dir });


        await this.initVagrantFile(path.join(dir, 'Vagrantfile'), doc, template, scriptPath);

        try {

            await machine.upAsync();

            let sshConfig = await this.getSSHConfig(machine);
            let ip = doc.vagrant.network.find((item)=>item.private_network!=undefined).private_network.ip;
            await Ssh.copyFromHostToVM(
                sshConfig.private_key,
                `/home/vagrant/baker/${doc.name}/${ip}_rsa`,
                ansibleSSHConfig
            );

            await this.addToAnsibleHosts(ip, doc.name, ansibleSSHConfig, sshConfig)
            await this.setKnownHosts(ip, ansibleSSHConfig);

            if(doc.bake && doc.bake.ansible && doc.bake.ansible.playbooks){
                print.info('Running your Ansible playbooks.', 1);

                let vmSSHConfig = await this.getSSHConfig(machine);

                for( var i = 0; i < doc.bake.ansible.playbooks.length; i++ ) {
                    var cmd = doc.bake.ansible.playbooks[i];
                    await this.runAnsiblePlaybook(
                        doc, cmd, ansibleSSHConfig, false, {}
                    )
                }
            }

            if( doc.bake && doc.bake.vault && doc.bake.vault.checkout && doc.bake.vault.checkout.key) {
                print.info('Checking out keys from vault.', 1);
                let vaultFile = `/home/vagrant/baker/${doc.name}/baker-vault.yml`;
                await Ssh.copyFromHostToVM(
                    path.resolve( scriptPath, doc.bake.vault.source ),
                    vaultFile,
                    ansibleSSHConfig
                );
                // prompt vault pass
                let pass = await this.promptValue('pass', `vault pass for ${doc.bake.vault.source}`, hidden=true);
                // ansible-vault to checkout key and copy to dest.
                await this.runAnsibleVault(doc, pass, doc.bake.vault.checkout.dest, ansibleSSHConfig)
            }

        } catch (err) {
            throw err;
        }
    }

    static async bake2 (ansibleSSHConfig, ansibleVM, scriptPath, verbose) {
        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));

        let dir = path.join(boxes, doc.name);
        let template = await fs.readFile(path.join(configPath, './BaseVM.mustache'), 'utf8');

        try {
            await fs.ensureDir(dir);
        } catch (err) {
            throw `Creating directory failed: ${dir}`;
        }

        let machine = vagrant.create({ cwd: dir });

        await this.initVagrantFile(path.join(dir, 'Vagrantfile'), doc, template, scriptPath);

        try {

            machine.on('up-progress', function(data) {
                //console.log(machine, progress, rate, remaining);
                if( verbose ) print.info(data);
            });

            await spinner.spinPromise(machine.upAsync(), `Provisioning VM in VirtualBox`, spinnerDot);

            let sshConfig = await this.getSSHConfig(machine);

            let ip = doc.vagrant.ip;
            await Ssh.copyFromHostToVM(
                sshConfig.private_key,
                `/home/vagrant/baker/${doc.name}/${ip}_rsa`,
                ansibleSSHConfig
            );

            await this.addToAnsibleHosts(ip, doc.name, ansibleSSHConfig, sshConfig)
            await this.setKnownHosts(ip, ansibleSSHConfig);
            await this.mkTemplatesDir(doc, ansibleSSHConfig);

            // prompt for passwords
            if( doc.vars )
            {
                await this.traverse(doc.vars);
            }

            // let vmSSHConfig = await this.getSSHConfig(machine);

            // Installing stuff.
            let resolveB = require('../bakelets/resolve');
            await resolveB.resolveBakelet(bakeletsPath, remotesPath, doc, scriptPath, verbose)

        } catch (err) {
            console.log(err.stack);
            throw err;
        }
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
            await this.setKnownHosts(vmSSHConfig.ip, ansibleSSHConfig);
            await this.mkTemplatesDir(doc, ansibleSSHConfig);

            // prompt for passwords
            if( doc.vars ) {
                await this.traverse(doc.vars);
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
            await this.traverse(doc.vars);
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

        await this.mkTemplatesDir(doc, ansibleSSHConfig);

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
            await this.setKnownHosts(ip, ansibleSSHConfig);
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

    static async package (VMName, verbose) {
        let dir = path.join(boxes, VMName);
        await child_process.execAsync(`cd ${dir} && vagrant package --output ${path.join(process.cwd(), VMName + '.box')}`, {stdio: ['inherit', 'inherit', 'ignore']});
    }



    static async import (box, name, verbose) {
        let boxName = name ? name : path.basename(box).split('.')[0];
        await vagrant.boxAddAsync(path.join(process.cwd(), box), ['--name', boxName + '.baker'])
        // await child_process.execAsync(`vagrant box add ${boxName}.baker ${path.join(process.cwd(), box)}`, {stdio: ['inherit', 'inherit', 'ignore']});
    }

    static async boxes () {
        try {
            let boxes = await vagrant.boxListAsync([]);
            delete boxes.version;
            return boxes;
        } catch (err) {
            throw err
        }
    }

    static async bakerBoxes (verbose=true) {
        try {
            let boxes = await this.boxes();
            let bakerBoxes = boxes.filter(box => box.name.match(/.baker$/));
            // Hide .baker from the end before printing
            bakerBoxes.forEach(box => {
                box.name = box.name.split('.')[0];
            })

            if(verbose){
                if(bakerBoxes == [])
                    print.info(`\nYou currently don't have any boxes.`)
                else
                    console.table('\nBaker boxes: ', bakerBoxes);
            }
            return bakerBoxes;
        } catch (err) {
            throw err
        }
    }

    static async bakeBox (ansibleSSHConfig, ansibleVM, scriptPath, verbose) {
        try {
            let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));

            let dir = path.join(boxes, doc.name);
            try {
                await fs.ensureDir(dir);
            } catch (err) {
                throw `Creating directory failed: ${dir}`;
            }

            let template = await fs.readFile(path.join(configPath, './BaseVM.mustache'), 'utf8');

            // if box is specified in baker.yml and this box exists, then use it => otherwise bake it
            if(doc.vagrant.box && (await this.bakerBoxes(false)).map(e=>e.name).includes(`${doc.vagrant.box}`)){

                await this.initVagrantFile(path.join(dir, 'Vagrantfile'), doc, template, scriptPath);

                let machine = vagrant.create({ cwd: dir });
                machine.on('up-progress', function(data) {
                    if( verbose ) print.info(data);
                });
                await spinner.spinPromise(machine.upAsync(), `Starting VM`, spinnerDot);
            }
            else {
                await this.bakeBox(sshConfig, ansibleVM, bakePath, verbose);
            }

        } catch (err) {
            throw err;
        }

        return;
    }
}

module.exports = Baker;
