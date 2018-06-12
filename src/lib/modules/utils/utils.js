const Promise         = require('bluebird');
const ping            = require('ping')
const prompt          = require('prompt');
const fs              = require('fs-extra');
const VagrantProvider = require('../providers/vagrant');
const DockerProvider  = require('../providers/docker');
const yaml            = require('js-yaml');
const path            = require('path');

class Utils {
    constructor() {}

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

    static async promptValue(propertyName, description, hidden=false) {
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

    static async hostIsAccessible(host) {
        return (await ping.promise.probe(host, {extra: ['-i 2']})).alive;
    }

    static async _ensureDir(path) {
        try {
            await fs.ensureDir(path);
        } catch (err) {
            throw `could not create directory: ${path} \n${err}`;
        }
    }

    /**
     * detects the type of environment.
     * Helper function for commands to automatically create the right provider object.
     * @param {String} bakePath path to the baker.yml file
     */
    static async chooseProvider(bakePath){
        // TODO: same problem with require, can't be outside static function?
        const Baker          = require('../baker');
        let doc = yaml.safeLoad(await fs.readFile(path.join(bakePath, 'baker.yml'), 'utf8'));
        let envType = doc.container ? 'container' : doc.vm || doc.vagrant ? 'vm' : 'other';

        let provider = null;
        if(envType === 'container')
            provider = new DockerProvider({host: '192.168.252.251', port: '2375', protocol: 'http'});
        else if(envType === 'vm')
            provider = new VagrantProvider();
        else
            console.error('This command only supports VM and container environments');

        let BakerObj = new Baker(provider);

        return {provider, BakerObj};
    }
}

module.exports = Utils;
