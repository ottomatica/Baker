const yaml = require('js-yaml');
const fs   = require('fs');
const path = require('path');
const Promise = require('bluebird');
const vagrant = Promise.promisifyAll(require('node-vagrant'));

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

async function getSSHConfig(machine) {
    try {
        let sshConfig = await machine.sshConfigAsync();
        if(sshConfig && sshConfig.length > 0){
            return sshConfig[0];
        } else{
            throw '';
        }
    } catch (err) {
        throw `Couldn't get private ssh key of machine ${err}`;
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

    let ansibleSSHConfig = await getSSHConfig(machine);

    let j = new classFoo("baker-test", ansibleSSHConfig, version);

    // TODO: Get associated roles/playbooks and copy to baker vm.
    await j.load();
    // Execute?
    //j.install();

}