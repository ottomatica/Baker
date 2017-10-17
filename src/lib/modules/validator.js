'use strict';

module.exports = function(dep) {
    let result = {};

    result.validateDependencies = async function(){
        const { hasbin, Promise } = dep;

        return new Promise((resolve, reject)=>{
            hasbin('vagrant', (hasVagrant)=>{
                hasbin('virtualbox', (hasVB)=>{
                    if(hasVB && hasVagrant)
                        resolve(true);
                    else
                        reject('Dependencies not found. Make sure you have installed VirtualBox and Vagrant.')
                })
            })
        })
    }

    result.validateBakerScript = async function(bakerScriptPath) {
        const { path, fs, yaml, validator, print } = dep;

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

    return result;
};
