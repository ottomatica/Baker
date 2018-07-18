const path            = require('path');
const Promise         = require('bluebird');
const ping            = require('ping')
const prompt          = require('prompt');
const fs              = require('fs-extra');
const _               = require('underscore');
const { envIndexPath } = require('../../../global-vars');

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

    static async initIndex(force = false) {
        if (!(await fs.pathExists(envIndexPath)) || force) {
            let envIndex = []

            try {
                await fs.outputJson(envIndexPath, envIndex, {spaces: 4});
            } catch (err) {
                console.error(err);
            }
        }
    }

    /**
     *
     * @param {String} type vm | container | DO
     * @param {Object} env
     */
    static async addToIndex(name, path, type, info) {
        await this.initIndex();
        try {
            let env = {name, path, type, info: _.pick(info, 'host', 'hostname', 'user', 'image', 'private_key', 'port')};
            if(!(await this.FindInIndex(env.name))){
                let envIndex = await fs.readJson(envIndexPath);
                envIndex.push(env);
                await fs.outputJson(envIndexPath, envIndex, {spaces: 4});
            }
        } catch (err) {
            console.error(err);
        }
    }

    /**
     * Find and return the env object from index or return null if it doesn't exist
     * @param {String} name name of the environment
     */
    static async FindInIndex(name) {
        let envIndex = await fs.readJson(envIndexPath);
        return envIndex.find(e => e.name === name) || null;
    }

    static async removeFromIndex(name) {
        let envIndex = await fs.readJson(envIndexPath);
        envIndex = envIndex.filter(e => e.name != name);
        await fs.outputJson(envIndexPath, envIndex, {spaces: 4});
    }

    static async setEnvIndexState(name, state) {
        let envIndex = await fs.readJson(envIndexPath);
        envIndex.forEach(env => {
            if(env.name === name)
                env.state = state;
        })
        await fs.outputJson(envIndexPath, envIndex, {spaces: 4});
    }

    static async getEnvIndex() {
        return await fs.readJson(envIndexPath);
    }

    // adapted from http://procbits.com/2011/11/15/synchronous-file-copy-in-node-js
    static async copyFileSync (inFile, outDir, fileName) {
        var BUF_LENGTH = 64 * 1024;

        var read;
        var write;

        var buffer = new Buffer.alloc(BUF_LENGTH); // new Buffer(BUF_LENGTH);

        var bytesRead = 1;
        var outFile = path.join( outDir, fileName || path.basename(inFile) );
        var pos = 0;

        await fs.ensureDir(outDir);
        read = fs.openSync(inFile, 'r');
        write = fs.openSync(outFile, 'w');

        while (bytesRead > 0) {
            bytesRead = fs.readSync(read, buffer, 0, BUF_LENGTH, pos);
            fs.writeSync(write, buffer, 0, bytesRead);
            pos += bytesRead;
        }

        fs.closeSync(read);

        return fs.closeSync(write);
    };

}

module.exports = Utils;
