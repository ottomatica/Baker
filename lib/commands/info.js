const Baker = require('../modules/baker');

exports.command = 'info <envName>';
exports.desc = 'provides information about a Baker environment';
exports.builder = (yargs) => {
    yargs
        .example(`$0 info baker-test`, `Outputs information about 'baker-test' environment`)
        .example(`$0 info baker-test --provider digitalocean`, `Provides information about 'baker-test' environment hosted on digitalocean`);

    yargs.positional('envName', {
            describe: 'Name of the environment',
            type: 'string'
        });

    yargs.options({
        verbose: {
            alias: 'v',
            describe: `Provide extended information about environment`,
            demand: false,
            type: 'boolean'
        }
    });

    yargs.options({
        provider: {
            alias: 'p',
            describe: `Provide provider-specific information for given environment`,
            demand: false,
            type: 'string'
        }
    });

}
exports.handler = async function(argv) {
    await Baker.info(argv.envName,argv.provider, argv.verbose);
}
