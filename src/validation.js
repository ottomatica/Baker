const path = require('path');
const fs = require('fs-extra');
const yaml = require('js-yaml');
const validator = require('validator');
const print = require(path.resolve('./print'));

class Validation{
    static validateBakerScript(bakerScriptPath){
        print.bold('Validating baker.yml');

        let doc;
        try {
            doc = yaml.safeLoad(fs.readFileSync(path.join(bakerScriptPath, 'baker.yml'), 'utf8'));
        } catch (error) {
            print.error(`baker.yml error: Couldn't parse baker.yml`, 1);
        }
        let passed = true;

        if(!doc.name){
            print.error('baker.yml error: You need to provide a name for your VM.', 1);
            passed = false;
        }

        if(!doc.vagrant){
            print.error('baker.yml error: You need to specify your VM configurations.', 1);
            passed = false;
        }

        if(!doc.vagrant.box){
            print.error(`baker.yml error: You need to specify what vagrant box you want Baker to use for your VM.`, 1);
            print.error(`If you're not sure, we suggest using ubuntu/trusty64`, 2);
            passed = false;
        }

        if(!doc.vagrant.memory){
            print.error('baker.yml error: You need to specify how much RAM you want Baker to share with your VM.', 1);
            passed = false;
        } else if(doc.vagrant.memory > 2048){
            print.warning(`baker.yml warning: Sharing big amounts of RAM with your VM can possibly slow down your computer.`, 1)
        }

        if(!doc.vagrant.network || !doc.vagrant.network.some(network => network.private_network != undefined)){
            print.error('baker.yml error: You need to create a private network for Baker to use for communicating with your VM.', 1);
            passed = false;
        } else if(!doc.vagrant.network.some(network => validator.isIP(network.private_network.ip))){
            print.error(`baker.yml error: Private network doesn't have a valid IP address`, 1);
            passed = false;
        }

        if(!passed){
            print.error('Use `baker --init` to create a baker.yml which you can then update for your project.', 2);
            process.exit(1);
        } else {
            print.success('baker.yml passed validation', 1);
        }
    }
}

module.exports = Validation;
