const path = require('path');
const boxes = path.join(require('os').homedir(), '.baker');
const bakerForMacPath = process.platform === 'darwin' ? path.join(require('os').homedir(), 'Library', 'Baker', 'BakerForMac') : undefined;
const bakerForMacSSHConfig = process.platform === 'darwin' ? {port: 6022, user: 'root', private_key: path.join(bakerForMacPath, 'baker_rsa'), hostname: 'localhost'} : undefined;


module.exports = {
    boxes       : boxes,
    ansible     : path.join(boxes, 'ansible-srv'),
    configPath  : path.join(__dirname, './config'),
    bakeletsPath: path.join(__dirname, './lib/bakelets'),
    remotesPath : path.join(__dirname, './remotes'),
    envIndexPath: path.join(boxes, 'data', 'index.json'),
    bakerForMacPath,
    bakerForMacSSHConfig
    // spinnerDot  : 'dots'
};
