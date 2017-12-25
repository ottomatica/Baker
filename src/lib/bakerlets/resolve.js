const yaml = require('js-yaml');
const fs   = require('fs');
const path = require('path');
const Promise = require('bluebird');
const vagrant = Promise.promisifyAll(require('node-vagrant'));


const scp2 = require('scp2');
const ssh2 = require('ssh2');

const baker = require('../modules/baker')({scp2: scp2, ssh2: ssh2});


module.exports.resolveBakerlet = async function(config)
{
    let doc;
    try {
        doc = yaml.safeLoad(
            fs.readFileSync(config, 'utf8')
        );

        console.log( doc )
        
        if( doc.lang )
        {
            for (var i = 0; i < doc.lang.length; i++) 
            {
                await resolve("lang", doc.lang[i]);
            }
        }
        

    } catch (error) {
        throw `Error: ${error}`
    }
}

async function resolve(dir, bakerlet)
{
    let regex = /([a-zA-Z-]+)([0-9]*)/;
    let mod = './' + dir + "/" + bakerlet;
    let match = "java8".match(regex);
    let version = null;
    if( match.length == 3)
    {
        mod = './' + dir + "/" + match[1];
        version = match[2];
    }

    let classFoo = require(mod)


    const boxes = path.join(require('os').homedir(), '.baker');
    const ansible = path.join(boxes, 'ansible-srv');

    let machine = vagrant.create({ cwd: ansible });

    let ansibleSSHConfig = await baker.getSSHConfig(machine);

    let j = new classFoo("baker-test","C:/dev/Baker/src/remotes/bakerlets-source/",
                         ansibleSSHConfig, "bakerletsPath", version);

    // TODO: Get associated roles/playbooks and copy to baker vm.
    j.load();
    // Execute?
    //j.install();

}