const path = require('path');
const boxes = path.join(require('os').homedir(), '.baker');

module.exports = {
    boxes       : boxes,
    ansible     : path.join(boxes, 'ansible-srv'),
    configPath  : path.join(__dirname, './config'),
    bakeletsPath: path.join(__dirname, './lib/bakelets'),
    remotesPath : path.join(__dirname, './remotes'),
    envIndexPath: path.join(boxes, 'data', 'index.json')
    // spinnerDot  : 'dots'
};
