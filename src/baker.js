const path = require('path');
const requireDir = require('require-dir');
require('console.table');

// Load commands from folder and pass dependencies
const commandsFn = requireDir(path.join(__dirname, 'lib', 'commands'));
const commands = Object.keys(commandsFn).map(i => commandsFn[i]());

// Export commands and modules separatelly
module.exports = { commands };
