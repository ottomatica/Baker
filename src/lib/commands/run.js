const Baker     = require('../modules/baker');
const Print     = require('../modules/print');
const Spinner   = require('../modules/spinner');
const conf      = require('../../lib/modules/configstore');
const yaml      = require('js-yaml');
const fs        = require('fs');
const path      = require('path');
const chalk     = require('chalk');

const  { bakerSSHConfig } = require('../../global-vars');

const spinnerDot = conf.get('spinnerDot');


exports.command = 'run [cmdlet]'
exports.desc = 'Run registered cmdlet in baker environment';
exports.builder = (yargs) => {
    yargs
        .example(`$0 run cmdlet`, `Run the cmdlet in the baker environment`)
    yargs.options(
        {
            useContainer: {
                describe: `Override environment type to use container`,
                demand: false,
                type: 'boolean'
            },
            useVM: {
                describe: `Override environment type to use vm`,
                demand: false,
                type: 'boolean'
            }
        }
    );

    yargs.positional('cmdlet', {
             describe: 'Command inside baker.yml under commands:',
             type: 'string'
    });

};

exports.handler = async function(argv) {
    const { cmdlet, useContainer, useVM } = argv;

    try{

        let bakePath = process.cwd();
        const {envName, provider, BakerObj} = await Baker.chooseProvider(bakePath, useContainer, useVM);


        let cmd = "";
        if( cmdlet == "hello" )
        {
            cmd = "echo 'hello'";
        }
        else
        {
            let content = fs.readFileSync(path.join(bakePath, 'baker.yml'), 'utf8');
            let doc = await yaml.safeLoad(content);

            if( doc.commands && doc.commands.hasOwnProperty(cmdlet) )
            {
                let cmdScript = doc.commands[cmdlet];

                let mount = path.basename(bakePath);

                cmd = `cd /${mount}; ${cmdScript}`;
            }
            else
            {
                console.log(`The following cmdlets are available in ${envName} 🍞:`)
                for( let c in doc.commands )
                {
                    console.log(`${chalk.blueBright(c)}\t${doc.commands[c]}`);
                }
                process.exit(1);
            }
        }

        console.log(`Running ${cmdlet} in ${envName} 🍞`);

        await provider.ssh(envName, cmd, true).catch( function(err)
        {
            Print.error(err);
        });

    } catch (err) {
        Print.error(err);
    }
}
