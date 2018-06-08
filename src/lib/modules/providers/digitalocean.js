const digitalocean = require('digitalocean');
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

class DO_Provider {
    constructor(token,clusterDir) {
        this.token = token || process.env.DOTOKEN;
        if( !token )
            throw new Error("Must provide an API token for digital ocean");
        this.client = digitalocean.client(this.token);

        this.clusterDir = clusterDir;
        this.clusterName = path.basename(clusterDir);
        this.prepareSSHKeyPair(clusterDir);
    }

    prepareSSHKeyPair(dir)
    {
        let privatePath = path.resolve(dir,'id_rsa');
        let publicPath = path.resolve(dir,'id_rsa.pub');
        if( fs.existsSync(privatePath) && fs.existsSync(publicPath) )
            return;
        child_process.execSync(`ssh-keygen -q -t rsa -f ${privatePath} -N ''`);
    }

    // Used to get facts about cluster.
    async info()
    {
        let nodes = await this.getDropletsByTag(this.clusterName);
        let privatePath = path.resolve(this.clusterDir,'id_rsa');
        let facts = [];
        for( var node of nodes )
        {
            facts.push(
            {
                host: node.name,
                port: '22',
                hostname: node.networks.v4[0].ip_address,
                user: 'root',
                private_key: privatePath
            });
        }
        return facts;
    }

    async create(name)
    {
        var attributes = {
            name: name,
            region: 'nyc1',
            size: '1gb',
            image: 'ubuntu-16-04-x64',
            tags: [this.clusterName]
        };

        let key = await this.getOrCreateSSHKeyId();
        attributes.ssh_keys = [key.id];

        let droplet = await this.getDropletFromName(name);
        if( droplet == null )
            return await this.createDroplet(attributes);
        return droplet;
    }

    async getDropletFromName(name)
    {
        let droplets = await this.client.droplets.list();
        for( let droplet of droplets )
        {
            if( droplet.name === name )
            {
                return droplet;
            }
        }
        return null;
    }

    async getDropletsByTag(tag)
    {
        let droplets = await this.client.droplets.list();
        let list = [];
        for( let droplet of droplets )
        {
            if( droplet.tags.includes(tag))
            {
                list.push(droplet);
            }
        }
        return list;
    }


    async getOrCreateSSHKeyId()
    {
        let publicPath = path.resolve(this.clusterDir,'id_rsa.pub');
        let key = fs.readFileSync(publicPath).toString();

        let output = child_process.execSync(`ssh-keygen -E md5 -lf ${publicPath}`).toString();
        // let fingerprint = '2048 MD5:6e:55:af:d4:f4:ad:02:7e:45:0f:a9:03:4e:b6:ae:01 gameweld@cjparnin (RSA)';
        let parts = output.split(/\s+/);
        if( parts.length < 2)
        {
            throw new Error(`Invalid ssh fingerprint ${output}`);
        }
        let fingerprint = parts[1].slice(4);

        console.log(`Looking for fingerprint ${fingerprint}`);

        let storedKey = null;
        try
        {
            storedKey = await this.client.account.getSshKey(fingerprint);
        }
        catch(err)
        {
            let attributes =
            {
                name: this.clusterName,
                public_key: key,
            }
            storedKey = await this.client.account.createSshKey(attributes);
        }
        return storedKey;
    }

    async getSSHConfig(nodeName)
    {
        let privatePath = path.resolve(this.clusterDir,'id_rsa');
        let droplet = await this.getDropletFromName(nodeName);
        let ip = droplet.networks.v4[0].ip_address;
        return {
            host: nodeName,
            port: '22',
            hostname: ip,
            user: 'root',
            private_key: privatePath
        };
    }

    async createDroplet(attributes)
    {
        var self = this;
        // Poll for non-locked state every 10s
        let pollUntilDone = function (id, done) {
            self.client.droplets.get(id, function(err, droplet) {
                if (!err && droplet.locked === false) {
                    // we're done!
                    done.call();
                } else if (!err && droplet.locked === true) {
                    // back off 10s more
                    setTimeout(function() {
                    pollUntilDone(id, done);
                    }, (10 * 1000));
                } else {
                    pollUntilDone(id, done);
                }
            });
        }

        return new Promise(function(resolve, reject)
        {
            self.client.droplets.create(attributes, function(err, droplet) {
                if (err === null) {
                    pollUntilDone(droplet.id, function() {
                        console.log("We have a droplet: " + droplet.id + "!");
                        resolve(droplet);
                    });
                }
                else {
                    console.log(err);
                    reject();
                }
            });
        });

    }

}

// let foo = async function ()
// {
//     let token = process.env.DOTOKEN;
//     let dir = path.join(require('os').homedir(), '.baker', 'crumbcluster');

//     let doProvider = new DO_Provider(token,dir);
//     //let droplet = await doProvider.create('crumb-test4');
//     //let key = await doProvider.getOrCreateSSHKeyId();
//     //console.log( key.id );

//     console.log( await doProvider.info() );

// };
// foo();


module.exports = DO_Provider;
