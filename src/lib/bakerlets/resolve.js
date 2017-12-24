const yaml = require('js-yaml');



module.exports.resolveBakerlet = async function(config)
{
    let doc;
    try {
        doc = yaml.safeLoad(
            await fs.readFile(config, 'utf8')
        );
    
        if( doc.services )
        {
            for (var i = 0; i < doc.services.length; i++) 
            {
                resolve("services", baker.services[i]);
            }
        }
        

    } catch (error) {
        throw `baker.yml error: Couldn't parse baker.yml: ${error}`
    }
}

function resolve(dir, bakerlet)
{
    // TODO: Logic for things like java8 matching to java
    // Get associated roles/playbooks and copy to baker vm.
}