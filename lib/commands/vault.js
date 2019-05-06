
const Baker   = require('../modules/baker');
const conf    = require('../../lib/modules/configstore')
const Print   = require('../modules/print');
const Spinner = require('../modules/spinner');

const fs      = require('fs');
const prompt = require('prompt');

const VaultLib   = require('../modules/vault');

const spinnerDot = conf.get('spinnerDot');

exports.command = 'vault [file]';
exports.desc = `encrypt a file`;

exports.builder = (yargs) => {
    yargs
        .example(`$0 vault secret.json`, `Encrypt the secret.json file with a passphrase`)
        .example(`$0 vault -v secret.json`, `View unencrypted content with passphrase`)
        .example(`$0 vault -u secret.json`, `Unencrypt content with passphrase`)
        .example(`$0 vault -c`, `Clear vault passphrase`)
    yargs
        .positional('file', {
            describe: 'file to encrypt',
            type: 'string'
        });

    yargs.options({
        clear: {
            alias: 'c',
            describe: `Clear vault passphrase`,
            demand: false,
            type: 'boolean'
        },
        view: {
            alias: 'v',
            describe: `view unencrypted content with passphrase`,
            demand: false,
            type: 'boolean'
        },
        decrypt: {
            alias: 'u',
            describe: `Unencrypt content with passphrase`,
            demand: false,
            type: 'boolean'
        },
    });


}


async function promptPass()
{
    return new Promise(function(resolve,reject)
    {
        var properties = [
            {
              name: 'password',
              hidden: true
            }
        ];
        
        prompt.start();
        
        prompt.get(properties, function (err, result) {
            if (err) { reject(err); }
            else
            {
                resolve(result.password)
            }
        });    
    });
}


exports.handler = async function(argv) {
    let { envName, verbose } = argv;

    try{
        // await Spinner.spinPromise(BakerObj.start(envName, verbose), `Starting VM: ${envName}`, spinnerDot);
        let passphraseKey = `vault:${process.cwd()}`;

        if( argv.clear )
        {
            conf.delete(passphraseKey);
            return;
        }
        
        if( !fs.existsSync(argv.file) )
        {
            throw new Error(`The provide file does not exist: ${argv.file}`)
        }

        if (!conf.has(passphraseKey))
        {
            let typedPassphrase = await promptPass();
            conf.set(passphraseKey, typedPassphrase);
        }

        let passphrase = conf.get(passphraseKey);
        let vault = new VaultLib();

        if( argv.decrypt)
        {
            let content = vault.retrieve(argv.file, passphrase);            
            console.log("Decrypting contents and writing to file.")
            fs.writeFileSync(argv.file, content);
        }
        else
        {
            if ( argv.view )
            {
                let content = vault.retrieve(argv.file, passphrase);            
                console.log("Viewing decrypted contents:")
                console.log(content);
            }
            else
            {
                vault.vault(argv.file, passphrase);
            }
        }

    } catch (err){
        Print.error(err);
    }
}
