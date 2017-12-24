const yaml = require('js-yaml');
const fs   = require('fs');


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
    let j = new classFoo("bakerletsPath", version);
    j.load();
    // TODO: Get associated roles/playbooks and copy to baker vm.
}