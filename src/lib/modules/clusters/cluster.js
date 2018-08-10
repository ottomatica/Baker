const Promise       = require('bluebird');
const conf          = require('../configstore');
const fs            = require('fs-extra');
const mustache      = require('mustache');
const netaddr       = require('netaddr');
const path          = require('path');
const print         = require('../print');
const spinner       = require('../Spinner');
const Ssh           = require('../ssh');
const Utils         = require('../utils/utils');
const vagrant       = Promise.promisifyAll(require('node-vagrant'));
const yaml          = require('js-yaml');

const VagrantProvider = require('../providers/vagrant');
const DO_Provider     = require('../providers/digitalocean');

// conf variables:
const spinnerDot = conf.get('spinnerDot');

const { configPath, boxes, bakeletsPath, remotesPath } = require('../../../global-vars');

class Cluster {

    constructor() {}

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
    static async addIpToAnsibleHosts(ip, name, sshConfig) {
        // TODO: check addToAnsibleHosts(), looks like that is doing the same thing too
        return Ssh.sshExec(`ansible all -i "localhost," -m lineinfile -a "dest=/etc/hosts line='${ip} ${name}' state=present" -c local --become`, sshConfig);
    }

    static async cluster(ansibleSSHConfig, ansibleVM, scriptPath, verbose) {
        let doc = yaml.safeLoad(await fs.readFile(path.join(scriptPath, 'baker.yml'), 'utf8'));

        // prompt for passwords
        if (doc.vars) {
            await Utils.traverse(doc.vars);
        }

        let getClusterLength = function (baseName, cluster) {
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
            return { nameProperty: name, length: length };
        }


        let cluster = {};
        let nodeDoc = {};

        if (doc.cluster && doc.cluster.plain) {
            cluster.cluster = {};
            cluster.cluster.nodes = [];

            let { nameProperty, length } = getClusterLength("nodes", doc.cluster.plain );
            nodeDoc = doc.cluster.plain[nameProperty];
            nodeDoc.name = doc.name;

            // Get base ip or assign default cluster ip
            let baseIp = doc.cluster.plain[nameProperty].ip || '192.168.20.2';
            let Addr = netaddr.Addr;

            for (var i = 0; i < length; i++) {
                // Create a copy from yaml
                let instance = Object.assign({}, doc.cluster.plain[nameProperty]);
                instance.name = `${doc.name.replace(/-/g,'')}${parseInt(i)+1}`;

                instance.ip = baseIp;
                // Set to next ip address, skipping prefix.
                baseIp = Addr(baseIp).increment().octets.join(".");

                instance.memory = instance.memory || 1024;
                instance.cpus   = instance.cpus || 1;

                cluster.cluster.nodes.push(instance);
            }
        }

        await Servers.mkTemplatesDir(doc, ansibleSSHConfig);

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
            await fs.writeFile(path.join(dir, 'Vagrantfile'), output);

            let machine = vagrant.create({ cwd: dir });

            machine.on('up-progress', function (data) {
                //console.log(machine, progress, rate, remaining);
                if (verbose) print.info(data);
            });

            await spinner.spinPromise(machine.upAsync(), `Provisioning cluster in VirtualBox`, spinnerDot);
        }

        let nodeList = [];
        //_.pluck(cluster.cluster.nodes, "ip");
        for (var i = 0; i < cluster.cluster.nodes.length; i++) {
            let node = cluster.cluster.nodes[i];
            let vmSSHConfig = await provider.getSSHConfig(node.name);

            let ip = node.ip;
            if (doc.provider && doc.provider === "digitalocean") {
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
            await provider.setKnownHosts(ip, ansibleSSHConfig);
            await this.addIpToAnsibleHosts(ip, node.name, ansibleSSHConfig);

            console.log(`${nodeList[i].ip} ${nodeList[i].user} ${vmSSHConfig.private_key}`);
        }

        if (doc.provider && doc.provider === "digitalocean") {
            await this.addClusterToBakerInventory(nodeList, doc.name, ansibleSSHConfig, true);
        } else {
            await this.addClusterToBakerInventory(nodeList, doc.name, ansibleSSHConfig, false);
        }

        let resolveB = require('../../bakelets/resolve');
        nodeDoc.vars = doc.vars;
        await resolveB.resolveBakelet(bakeletsPath, remotesPath, nodeDoc, scriptPath, verbose);

    }
}

module.exports = Cluster;
