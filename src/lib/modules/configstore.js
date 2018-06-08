const Configstore = require('configstore');
const pkg = require('../../package.json');
const conf = new Configstore(pkg.name, {} , {globalConfigPath: true});

// setting defaults
if(!conf.has('spinnerDot'))
    conf.set('spinnerDot', 'dots');

module.exports =  conf;
