const digitalocean = require('digitalocean');

class DO_Provider {
    constructor(token) {
        this.token = token || process.env.DOTOKEN;
        if( !token )
            throw new Error("Must provide an API token for digital ocean");
        this.client = digitalocean.client(this.token);         
    }

    async init(name)
    {
        var attributes = {
            name: name,
            region: 'nyc1',
            size: '1gb',
            image: 'ubuntu-16-04-x64'
        };
        let droplets = await this.client.droplets.list();
        for( let droplet of droplets )
        {
            if( droplet.name === name )
            {
                return droplet;
            }
        }
          
        return await this.createDroplet(attributes);
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
                    console.log("error requesting a droplet");
                    reject();
                }
            });
        });

    }

}

let foo = async function ()
{
    let token = process.env.DOTOKEN;
    let doProvider = new DO_Provider(token);
    let droplet = await doProvider.init('crumb-test');
    console.log(droplet);
};
foo();