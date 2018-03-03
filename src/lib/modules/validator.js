const Promise       = require('bluebird');
const drivelist = Promise.promisifyAll(require('drivelist'));
const fs        = require('fs-extra');
const hasbin    = require('hasbin');
const path      = require('path');
const print     = require('./print');
const validator = require('validator');
const yaml      = require('js-yaml');

class Validator{
    constructor () { }

    static async validateDependencies () {
        let platform = process.platform;
        let dependencyNotFound = 'Dependencies not found. Make sure you have installed VirtualBox and Vagrant.';

        if (platform == 'darwin' || platform === 'linux') {
            hasbin.all( ['vagrant', 'virtualbox'], hasDependencies => {
                if(hasDependencies) return true;
                else{
                    // throw dependencyNotFound;
                    print.warning(dependencyNotFound, 1)
                    return true;
                }

            });
        }
        else {
            hasbin('vagrant', async function (hasVagrant) {
                if(hasVagrant){
                    let drives = (await drivelist.listAsync()).map(d => d.mountpoints[0].path);
                    drives.forEach(drive => {
                        fs.access(path.resolve(path.join(drive, `/Program Files/Oracle/VirtualBox`)), err => {
                            if (err){
                                fs.access(path.resolve(path.join(drive, `/Program Files (x86)/Oracle/VirtualBox`)), err => {
                                    if(err) {
                                        fs.access(path.resolve(path.join(process.env.PROGRAMFILES, `/Oracle/VirtualBox`)), err => {
                                            if(err){
                                                // throw dependencyNotFound;
                                                print.warning(dependencyNotFound, 1)
                                                return true;
                                            }
                                        });
                                    }
                                });
                            }
                            return true;
                        });
                    })
                } else {
                    // throw dependencyNotFound;
                    print.warning(dependencyNotFound, 1)
                    return true;
                }
            });
        }
    }

    static async validateBakerScript (bakerScriptPath) {
        let doc;
        try {
            doc = yaml.safeLoad(
                await fs.readFile(path.join(bakerScriptPath, 'baker.yml'), 'utf8')
            );
        } catch (error) {
            // print.error(`baker.yml error: Couldn't parse baker.yml:`, 1);
            // print.error(error, 1);
            // process.exit(1);
            throw `baker.yml error: Couldn't parse baker.yml: ${error}`
        }

        let passed = true;

        if (!doc.name) {
            // print.error(
            //     'baker.yml error: You need to provide a name for your VM.',
            //     1
            // );
            passed = false;
            throw 'baker.yml error: You need to provide a name for your VM.';
        }

        if (!doc.vagrant) {
            // print.error(
            //     'baker.yml error: You need to specify your VM configurations.',
            //     1
            // );
            passed = false;
            throw 'baker.yml error: You need to specify your VM configurations.';
        }

        if (!doc.vagrant.box) {
            // print.error(
            //     `baker.yml error: You need to specify what vagrant box you want Baker to use for your VM.`,
            //     1
            // );
            // print.error(
            //     `If you're not sure, we suggest using ubuntu/trusty64`,
            //     2
            // );
            passed = false;
            throw `baker.yml error: You need to specify what vagrant box you want Baker to use for your VM.`;
        }

        if (!doc.vagrant.memory) {
            // print.error(
            //     'baker.yml error: You need to specify how much RAM you want Baker to share with your VM.',
            //     1
            // );
            passed = false;
            throw 'baker.yml error: You need to specify how much RAM you want Baker to share with your VM.';
        } else if (doc.vagrant.memory > 2048) {
            print.warning(
                 `baker.yml warning: Sharing big amounts of RAM with your VM can possibly slow down your computer.`,
                 1
            );
            //throw `baker.yml warning: Sharing big amounts of RAM with your VM can possibly slow down your computer.`;
        }

        if (
            !doc.vagrant.network ||
            !doc.vagrant.network.some(
                network => network.private_network != undefined
            )
        ) {
            // print.error(
            //     'baker.yml error: You need to create a private network for Baker to use for communicating with your VM.',
            //     1
            // );
            passed = false;
            throw 'baker.yml error: You need to create a private network for Baker to use for communicating with your VM.';
        } else if (
            !doc.vagrant.network.some(network =>
                network.private_network && validator.isIP(network.private_network.ip)
            )
        ) {
            // print.error(
            //     `baker.yml error: Private network doesn't have a valid IP address`,
            //     1
            // );
            passed = false;
            throw `baker.yml error: Private network doesn't have a valid IP address`;
        }

        if (!passed) {
            // print.error(
            //     'Use `baker --init` to create a baker.yml which you can then update for your project.',
            //     2
            // );
            // process.exit(1);
            throw 'Use `baker --init` to create a baker.yml which you can then update for your project.';
        } else {
            // print.success('baker.yml passed validation', 1);
            return;
        }
    }
}

module.exports = Validator;
