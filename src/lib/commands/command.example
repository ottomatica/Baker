exports.command = 'command <demand> [not_demand]';
// exports.aliases = ['$0'];
exports.desc = 'Description of command';
exports.builder = (yargs) => {
    yargs
        .example(`$0 command default`, `This is an example of how to use this command`)
        .example(`$0 command default default`, `This is another example of how to use this command`);

    yargs
        .positional('demand', {
            describe: 'You have to specify this',
            type: 'string',
            default: 'default'
        })
        .positional('not_demand', {
            describe: 'You can to specify this',
            type: 'string'
        });

    yargs.options({
        opt: {
            alias: ['o', 'oo'],
            describe: `This is an option`,
            demand: false,
            type: 'string',
            default: '.'
        }
    });
}

exports.handler = async function(argv) {
    console.log('Running command... ');
}
