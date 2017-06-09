const program = require('commander');

program
    .command('install')
    .description('Install virtualbox, vagrant, and ansible build servers.')
    .option('-p, --pull', 'Pull ansible box from ottomatica servers')
    .action(function(cmd, options){
        
    })

program
    .option('-p, --pull', 'Pull the provisioned box from ottomatica servers.')

program.on('--help', function(){
  console.log('  Example provisioning:');
  console.log('');
  console.log('    $ baker https://github.com/alt-code/Dazed');
  console.log('    $ baker --pull https://github.com/alt-code/Dazed');  
  console.log('');
});

module.exports = program;
