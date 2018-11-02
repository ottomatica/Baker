const mustache = require('mustache');
const yaml = require('js-yaml');
const fs = require('fs');
const prompt = require("prompt");

async function promptValue(propertyName, description)
{
    return new Promise((resolve, reject) => {
        prompt.start();
        prompt.get([{name: propertyName, description: description }], function (err, result)
        {
            if (err) { console.log(err); }
            //prompt.stop();
            resolve(result[propertyName]);
        });
    });
}

async function traverse(o) {
    const stack = [{obj: o, parent: null, parentKey:""}]

    while (stack.length) {
        const s = stack.shift()
        const obj = s.obj;
        const parent = s.parent;
        const parentKey = s.parentKey;

        for( var i = 0; i < Object.keys(obj).length; i++ )
        {
            let key = Object.keys(obj)[i];

            //await fn(key, obj[key], obj)

            if (obj[key] instanceof Object) {
                stack.unshift({obj: obj[key], parent: obj, parentKey: key})
            }

            if( key == "prompt")
            {
                const input = await promptValue(parentKey, obj[key]);
                // Replace "prompt" with an value provided by user.
                parent[parentKey] = input;
            }

        }
    }
    return o;
}

( async() =>
{
    template = fs.readFileSync( "../config/BaseVM.mustache" ).toString();
    let doc = yaml.safeLoad(fs.readFileSync("resources/baker.yml", 'utf8'));

    const vagrant = doc.vagrant;
    const x = await traverse(vagrant);
    const output = mustache.render(template, doc);

    console.log(output);
})();

