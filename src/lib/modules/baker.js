'use strict';

module.exports = function(dep) {
    let result = {};

    result.init = async function(){
        const { fs, path, configPath } = dep;

        let bakerYML = await fs.readFileAsync(path.join(configPath, './bakerTemplate.yml'), 'utf8');
        let dir = path.resolve(process.cwd());
        await fs.writeFileAsync('baker.yml', bakerYML, {encoding:'utf8'});
    }

    /**
     * get State of a vagrant vm by id.
     * @param {String} id
     */
    result.getState = async function(id) {
        const { vagrant, chalk, Promise } = dep;

        try {
            let VMs = await vagrant.globalStatusAsync();
            let VM = VMs.filter(VM => VM.id == id)[0];
            if(!VM)
                throw  `Cannot find machine: ${id}`;
            return VM.state;
        } catch (err) {
            throw err;
        }
    };

    /**
     * get vagrant id of VMs by name
     */
    result.getVagrantIDByName = async function(VMName) {
        const { vagrant } = dep;

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
    result.bakerSSH = async function(name) {
        const { print, baker, child_process } = dep;

        try {
            let id = await baker.getVagrantIDByName(name);
            try {
                child_process.execSync(`vagrant ssh ${id}`, {stdio: ['inherit', 'inherit', 'ignore']});
            } catch (err) {
                throw `VM must be running to open SSH connection. Run \`baker status\` to check status of your VMs.`
            }
        } catch(err) {
            throw err;
        }
    };


    /**
     * Checks if ansible server is up, if not it starts the server
     * It will also copy new vm's ansible script to ~/baker/{name}/ in ansible server
     * Returns a promise, use cleaner es7 syntax:
     * Resolves the ansible machine
     * ------
     * await prepareAnsibleServer()
     * ...do something after finished preparing server
     * ------
     */
    result.prepareAnsibleServer = async function(bakerScriptPath) {
        const { vagrant, fs, yaml, baker, print, ssh, ansible, path, Promise } = dep;

        let machine = vagrant.create({ cwd: ansible });
        let doc = yaml.safeLoad(await fs.readFileAsync(path.join(bakerScriptPath, 'baker.yml'), 'utf8'));

        try {
            let bakerVMID = await baker.getVagrantIDByName('baker');
            let state = await baker.getState(bakerVMID);
            if (state === 'running') {
                let ansibleSSHConfig = await baker.getSSHConfig(machine);
                await ssh.copyFilesForAnsibleServer(bakerScriptPath, doc, ansibleSSHConfig);
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
                let ansibleSSHConfig = await baker.getSSHConfig(machine);

                await ssh.copyFilesForAnsibleServer(bakerScriptPath, doc, ansibleSSHConfig);

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
    async function getVMPath(VMName){
        const { vagrant, print, Promise } = dep;

        let VMs = await vagrant.globalStatusAsync();
        let VM = VMs.find(VM => VM.name === VMName);

        if(VM)
            return VM.cwd;
        else
            throw `Cannot find machine: ${VMName}`;
    }

    /**
     * Destroy VM
     * @param {String} VMName
     */
    result.destroyVM = async function(VMName) {
        const { vagrant } = dep;

        try {
            let VMPath = await getVMPath(VMName);
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
    result.prune = async function() {
        const { child_process, print, baker, vagrant } = dep;

        try {
            await vagrant.globalStatusAsync('--prune');
            await baker.status();
            return;
        } catch (err) {
            throw err;
        }
    }

    /**
     * Shut down VM
     * @param {String} id
     */
    result.haltVM = async function(VMName, force=false) {
        const { print, vagrant, baker } = dep;

        try {
            let VMPath = await getVMPath(VMName);
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
    result.upVM = async function(VMName) {
        const { vagrant, print } = dep;

        try {
            let VMPath = await getVMPath(VMName);
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
    };

    /**
     * Creates ansible server, if already doesn't exist
     */
    result.installAnsibleServer = async function() {
        const { baker, fs, mustache, path, configPath, vagrant, ansible, boxes } = dep;

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
            bakerVMID = await baker.getVagrantIDByName('baker');
            bakerVMState = await baker.getState(bakerVMID);
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
    result.reinstallAnsibleServer = async function() {
        const { baker } = dep;

        try {
            await baker.destroyVM('baker');
        } catch (err) {
            if (err != `Cannot find machine: baker`) {
                throw err;
            }
        }
        await baker.installAnsibleServer();
        return;
    }

    /**
     * Get ssh configurations
     * @param {Obj} machine
     * @param {Obj} nodeName Optionally give name of machine when multiple machines declared in single Vagrantfile.
     */
    result.getSSHConfig = async function(machine, nodeName) {
        const { print, Promise } = dep;

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
    result.addToAnsibleHosts = async function(ip, name, sshConfig){
        const { ssh } = dep;
        // TODO: Callers of this can be refactored to into two methods, below:
        return ssh.sshExec(`echo "[${name}]\n${ip}" > /home/vagrant/baker/${name}/baker_inventory && ansible all -i "localhost," -m lineinfile -a "dest=/etc/hosts line='${ip} ${name}' state=present" -c local --become`, sshConfig);
    }

    /**
     * Adds the host url to /etc/hosts
     *
     * @param {List} ipList, list of ip address to add to host
     * @param {String} name
     * @param {Object} sshConfig
     */
    result.addClusterToBakerInventory = async function(ipList, name, sshConfig){
        const { ssh } = dep;

        let hosts = ipList.join('\n');
        await ssh.sshExec(`echo "[${name}]\n${hosts}" > /home/vagrant/baker/${name}/baker_inventory`, sshConfig);
    }

    /**
     * Adds the host url to /etc/hosts (without adding anything to inventory)
     *
     * @param {String} ip
     * @param {String} name
     * @param {Object} sshConfig
     */
    result.addIpToAnsibleHosts = async function(ip, name, sshConfig){
        const { ssh } = dep;

        return ssh.sshExec(`ansible all -i "localhost," -m lineinfile -a "dest=/etc/hosts line='${ip} ${name}' state=present" -c local --become`, sshConfig);
    }



    result.retrieveSSHConfigByName = async function(name) {
        const { ssh,baker,boxes, path, vagrant } = dep;

        let dir = path.join(boxes, name);
        let vm = vagrant.create({ cwd: dir });
        let vmSSHConfigUser = await baker.getSSHConfig(vm);

        return vmSSHConfigUser;
    }


    result.setKnownHosts = async function(ip, sshConfig) {
        const { ssh } = dep;

        return ssh.sshExec(`cd /home/vagrant/baker/ && ansible-playbook -i "localhost," registerhost.yml -e "ip=${ip}" -c local`, sshConfig);
    }

    result.runAnsibleVault = async function(doc, pass, dest, sshConfig, vmSSHConfigUser) {
        const { ssh, Promise } = dep;

        return new Promise( async (resolve, reject) => {
            let key = doc.bake.vault.checkout.key;
            await ssh.sshExec(`cd /home/vagrant/baker/${doc.name} && echo "${pass}" > vault-pwd`, sshConfig);
            await ssh.sshExec(`cd /home/vagrant/baker/${doc.name} && ansible-playbook -e "vault=${doc.name}/baker-vault.yml key=${key} dest=${dest}" -i baker_inventory --vault-password-file=vault-pwd --private-key id_rsa -u ${vmSSHConfigUser.user} ../CheckoutFromVault.yml`, sshConfig)
            //await sshExec(`cd /home/vagrant/baker/${doc.name} && echo "${pass}" > vault-pwd &&  ansible-vault view baker-vault.yml --vault-password-file=vault-pwd > checkout.key`, sshConfig);
            //await sshExec(`cd /home/vagrant/baker/${doc.name} && ansible all -i baker_inventory --private-key id_rsa -u ${vmSSHConfigUser.user} -m copy -a "src=checkout.key dest=${dest} mode=0600"`, sshConfig)
            await ssh.sshExec(`cd /home/vagrant/baker/${doc.name} && rm vault-pwd`, sshConfig)
            resolve();
        });
    }

    // TODO: Need to be cleaning cmd so they don't do things like
    // ; sudo rm -rf / on our server...
    result.runAnsiblePlaybook = async function(doc, cmd, ansibleSSHConfig, vmSSHConfig, verbose, variables) {
        const { path, vagrant, baker, ssh, boxes } = dep;

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
        return ssh.sshExec(`export ANSIBLE_HOST_KEY_CHECKING=false && cd /home/vagrant/baker/${doc.name} && echo '${extravars}' > playbook.args.json && ansible-playbook -e @playbook.args.json -i baker_inventory ${cmd} --private-key id_rsa -u ${vmSSHConfig.user}; rm -f playbook.args.json`, ansibleSSHConfig, verbose);
    }

    result.runAnsibleAptInstall = async function(doc, cmd, ansibleSSHConfig, vmSSHConfig,verbose) {
        const { path, vagrant, baker, ssh, boxes } = dep;

        return ssh.sshExec(`export ANSIBLE_HOST_KEY_CHECKING=false && cd /home/vagrant/baker/${doc.name} && ansible all -m apt -a "pkg=${cmd} update_cache=yes cache_valid_time=86400" -i baker_inventory --private-key id_rsa -u ${vmSSHConfig.user} --become`, ansibleSSHConfig, verbose);
    }

    result.runAnsiblePipInstall = async function(doc, requirements, ansibleSSHConfig, vmSSHConfig, verbose) {
        const { path, vagrant, baker, ssh, boxes } = dep;

        return ssh.sshExec(`export ANSIBLE_HOST_KEY_CHECKING=false && cd /home/vagrant/baker/${doc.name} && ansible all -m pip -a "requirements=${requirements}" -i baker_inventory --private-key id_rsa -u ${vmSSHConfig.user} --become`, ansibleSSHConfig, verbose);
    }

    result.runAnsibleNpmInstall = async function(doc, packagejson, ansibleSSHConfig, vmSSHConfig, verbose) {
        const { path, vagrant, baker, ssh, boxes } = dep;

        return ssh.sshExec(`export ANSIBLE_HOST_KEY_CHECKING=false && cd /home/vagrant/baker/${doc.name} && ansible all -m npm -a "path=${packagejson}" -i baker_inventory --private-key id_rsa -u ${vmSSHConfig.user}`, ansibleSSHConfig, verbose);
    }



    result.mkTemplatesDir = async function(doc, ansibleSSHConfig) {
        const { path, vagrant, baker, ssh, boxes } = dep;

        return ssh.sshExec(`mkdir -p /home/vagrant/baker/${doc.name}/templates`, ansibleSSHConfig);
    }

    result.runAnsibleTemplateCmd = async function(doc, src, dest, variables, ansibleSSHConfig, vmSSHConfig, verbose) {
        const { path, vagrant, baker, yaml, ssh, boxes } = dep;

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
        return ssh.sshExec(`export ANSIBLE_HOST_KEY_CHECKING=false && cd /home/vagrant/baker/${doc.name} && echo '${extravars}' > template.args.json && ansible all -m template -a "src=${src} dest=${dest}" -e @template.args.json -i baker_inventory --private-key id_rsa -u ${vmSSHConfig.user}; rm -f template.args.json`, ansibleSSHConfig, verbose);
    }


    result.promptValue = async function(propertyName, description, hidden=false) {
        const { prompt, Promise, print } = dep;

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
    async function traverse(o) {
        const { baker } = dep;
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
                    const input = await baker.promptValue(parentKey, obj[key]);
                    // Replace "prompt" with an value provided by user.
                    parent[parentKey] = input;
                }
            }
        }
        return o;
    }

    result.initVagrantFile = async function(vagrantFilePath, doc, template, scriptPath) {
        const { mustache, fs, path, slash, baker } = dep;

        if (doc.vm ) {
            doc.vagrant = doc.vm;
            delete doc.vm;
        }
        const vagrant = doc.vagrant;
        await traverse(vagrant);

        // Defaults
        // vagrant.box = vagrant.box || "ubuntu/xenial64"
        // TODO: Cleanup this mess
        if     (vagrant.box && (await baker.boxes()).map(e=>e.name).includes(`${vagrant.box}.baker`)){
            vagrant.box = vagrant.box + '.baker';
        }
        else if(vagrant.box && (await baker.boxes()).map(e=>e.name).includes(`${vagrant.box}`)){
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
            let ports = vagrant.ports.trim().split(/\s*,\s*/g);
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

    result.status = async function() {
        const { vagrant } = dep;

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

    result.bake = async function(ansibleSSHConfig, ansibleVM, scriptPath) {
        var { yaml, path, fs, vagrant, baker, print, ssh, boxes, configPath } = dep;

        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));

        let dir = path.join(boxes, doc.name);
        let template = await fs.readFile(path.join(configPath, './BaseVM.mustache'), 'utf8');

        try {
            await fs.ensureDir(dir);
        } catch (err) {
            throw `Creating directory failed: ${dir}`;
        }

        let machine = vagrant.create({ cwd: dir });


        await baker.initVagrantFile(path.join(dir, 'Vagrantfile'), doc, template, scriptPath);

        try {

            await machine.upAsync();


            let sshConfig = await baker.getSSHConfig(machine);
            let ip = doc.vagrant.network.find((item)=>item.private_network!=undefined).private_network.ip;
            await ssh.copyFromHostToVM(
                sshConfig.private_key,
                `/home/vagrant/baker/${doc.name}/id_rsa`,
                ansibleSSHConfig
            );

            await baker.addToAnsibleHosts(ip, doc.name, ansibleSSHConfig)
            await baker.setKnownHosts(ip, ansibleSSHConfig);

            if(doc.bake && doc.bake.ansible && doc.bake.ansible.playbooks){
                print.info('Running your Ansible playbooks.', 1);

                let vmSSHConfig = await baker.getSSHConfig(machine);

                for( var i = 0; i < doc.bake.ansible.playbooks.length; i++ ) {
                    var cmd = doc.bake.ansible.playbooks[i];
                    await baker.runAnsiblePlaybook(
                        doc, cmd, ansibleSSHConfig, vmSSHConfig, false, {}
                    )
                }
            }

            if( doc.bake && doc.bake.vault && doc.bake.vault.checkout && doc.bake.vault.checkout.key) {
                print.info('Checking out keys from vault.', 1);
                let vaultFile = `/home/vagrant/baker/${doc.name}/baker-vault.yml`;
                await ssh.copyFromHostToVM(
                    path.resolve( scriptPath, doc.bake.vault.source ),
                    vaultFile,
                    ansibleSSHConfig
                );
                // prompt vault pass
                let pass = await baker.promptValue('pass', `vault pass for ${doc.bake.vault.source}`, hidden=true);
                // ansible-vault to checkout key and copy to dest.
                await baker.runAnsibleVault(doc, pass, doc.bake.vault.checkout.dest, ansibleSSHConfig, sshConfig)
            }

        } catch (err) {
            throw err;
        }
    }

    result.bake2 = async function(ansibleSSHConfig, ansibleVM, scriptPath, verbose) {
        var { yaml, path, fs, vagrant, spinner, spinnerDot, baker, print, ssh, boxes, configPath, bakerletsPath, remotesPath } = dep;

        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));

        let dir = path.join(boxes, doc.name);
        let template = await fs.readFile(path.join(configPath, './BaseVM.mustache'), 'utf8');

        try {
            await fs.ensureDir(dir);
        } catch (err) {
            throw `Creating directory failed: ${dir}`;
        }

        let machine = vagrant.create({ cwd: dir });

        await baker.initVagrantFile(path.join(dir, 'Vagrantfile'), doc, template, scriptPath);

        try {

            machine.on('up-progress', function(data) {
                //console.log(machine, progress, rate, remaining);
                if( verbose ) print.info(data);
            });

            await spinner.spinPromise(machine.upAsync(), `Provisioning VM in VirtualBox`, spinnerDot);

            let sshConfig = await baker.getSSHConfig(machine);
            //let ip = doc.vagrant.network.find((item)=>item.private_network!=undefined).private_network.ip;
            let ip = doc.vagrant.ip;
            await ssh.copyFromHostToVM(
                sshConfig.private_key,
                `/home/vagrant/baker/${doc.name}/id_rsa`,
                ansibleSSHConfig
            );

            await baker.addToAnsibleHosts(ip, doc.name, ansibleSSHConfig)
            await baker.setKnownHosts(ip, ansibleSSHConfig);
            await baker.mkTemplatesDir(doc, ansibleSSHConfig);

            // prompt for passwords
            if( doc.vars )
            {
                await traverse(doc.vars);
            }

            let vmSSHConfig = await baker.getSSHConfig(machine);

            // Installing stuff.
            let resolveB = require('../bakerlets/resolve');
            await resolveB.resolveBakerlet(bakerletsPath, remotesPath, vmSSHConfig, doc, scriptPath, verbose)

        } catch (err) {
            throw err;
        }
    }

    result.bakeRemote = async function(ansibleSSHConfig, remoteIP, remoteKey, remoteUser, scriptPath, verbose) {
        var { yaml, path, fs, vagrant, spinner, spinnerDot, baker, print, ssh, boxes, configPath, bakerletsPath, remotesPath } = dep;

        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));
        let vmSSHConfig = {
            user: remoteUser,
            private_key: remoteKey,
            ip: remoteIP,
            port: 22
        }

        try {
            // TODO: copy the ssh key to ${ip}_rsa instead of id_rsa
            await ssh.copyFromHostToVM(
                vmSSHConfig.private_key,
                `/home/vagrant/baker/${doc.name}/id_rsa`,
                ansibleSSHConfig
            );
            await baker.addToAnsibleHosts(vmSSHConfig.ip, doc.name, ansibleSSHConfig)
            await baker.setKnownHosts(vmSSHConfig.ip, ansibleSSHConfig);
            await baker.mkTemplatesDir(doc, ansibleSSHConfig);

            // prompt for passwords
            if( doc.vars ) {
                await traverse(doc.vars);
            }

            // Installing stuff.
            let resolveB = require('../bakerlets/resolve');
            await resolveB.resolveBakerlet(bakerletsPath, remotesPath, vmSSHConfig, doc, scriptPath, verbose)

        } catch (err) {
            throw err;
        }
    }

    result.cluster = async function(ansibleSSHConfig, ansibleVM, scriptPath, verbose) {

        var { _, netaddr, mustache, slash, yaml, path, fs, vagrant, spinner, spinnerDot, baker, print, ssh, boxes, configPath, bakerletsPath, remotesPath } = dep;

        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));

        let dir = path.join(boxes, doc.name);
        let template = await fs.readFile(path.join(configPath, './ClusterVM.mustache'), 'utf8');

        try {
            await fs.ensureDir(dir);
        } catch (err) {
            throw `Creating directory failed: ${dir}`;
        }

        // prompt for passwords
        if( doc.vars )
        {
            await traverse(doc.vars);
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

        const output = mustache.render(template, cluster);
        await fs.writeFileAsync(path.join(dir, 'Vagrantfile'), output);

        let machine = vagrant.create({ cwd: dir });

        machine.on('up-progress', function(data) {
            //console.log(machine, progress, rate, remaining);
            if( verbose ) print.info(data);
        });

        await spinner.spinPromise(machine.upAsync(), `Provisioning cluster in VirtualBox`, spinnerDot);

        await baker.mkTemplatesDir(doc, ansibleSSHConfig);

        let ipList = _.pluck(cluster.cluster.nodes, "ip");
        await baker.addClusterToBakerInventory(ipList, doc.name, ansibleSSHConfig);

        for( var i = 0; i < cluster.cluster.nodes.length; i++ )
        {
            let node = cluster.cluster.nodes[i];
            let vmSSHConfig = await baker.getSSHConfig(machine, node.name);
            console.log( vmSSHConfig );
            await baker.setKnownHosts(node.ip, ansibleSSHConfig);
            await baker.addIpToAnsibleHosts(node.ip, node.name, ansibleSSHConfig);


            let resolveB = require('../bakerlets/resolve');
            await resolveB.resolveBakerlet(bakerletsPath, remotesPath, vmSSHConfig, nodeDoc, scriptPath, verbose);
        }

    }


    result.package = async function(VMName, verbose) {
        var { path, boxes, child_process } = dep;

        let dir = path.join(boxes, VMName);

        await child_process.execAsync(`cd ${dir} && vagrant package --output ${path.join(process.cwd(), VMName + '.box')}`, {stdio: ['inherit', 'inherit', 'ignore']});
    }

    result.import = async function(box, name, verbose) {
        var { path, boxes, child_process, vagrant } = dep;

        let boxName = name ? name : path.basename(box).split('.')[0];

        await vagrant.boxAddAsync(path.join(process.cwd(), box), ['--name', boxName + '.baker'])
        // await child_process.execAsync(`vagrant box add ${boxName}.baker ${path.join(process.cwd(), box)}`, {stdio: ['inherit', 'inherit', 'ignore']});
    }

    result.boxes = async function() {
        const { vagrant, print } = dep;
        try {
            let boxes = await vagrant.boxListAsync([]);
            delete boxes.version;
            return boxes;
        } catch (err) {
            throw err
        }
    }

    result.bakerBoxes = async function(verbose=true) {
        const { vagrant, print, baker } = dep;

        try {
            let boxes = await baker.boxes();
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

    result.bakeBox = async function(ansibleSSHConfig, ansibleVM, scriptPath, verbose) {
        const { vagrant, boxes, path, fs, spinner, spinnerDot, configPath, baker, yaml} = dep;

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
            if(doc.vagrant.box && (await baker.bakerBoxes(false)).map(e=>e.name).includes(`${doc.vagrant.box}`)){

                await baker.initVagrantFile(path.join(dir, 'Vagrantfile'), doc, template, scriptPath);

                let machine = vagrant.create({ cwd: dir });
                machine.on('up-progress', function(data) {
                    if( verbose ) print.info(data);
                });
                await spinner.spinPromise(machine.upAsync(), `Starting VM`, spinnerDot);
            }
            else {
                await baker.bakeBox(sshConfig, ansibleVM, bakePath, verbose);
            }

        } catch (err) {
            throw err;
        }

        return;
    }

    return result;
};
