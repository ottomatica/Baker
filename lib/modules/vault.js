const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const {version} = require('../../global-vars')

class VaultLib {
    constructor() 
    {
        this.iv = crypto.randomBytes(16);
        this.algorithm = 'aes-256-ctr';
        this.salt  = Buffer.from('5ebe2294ecd0e0f', 'hex');
        this.headerRegex = /baker-vault:\d+[.]\d+[.]\d+:[0-9A-Fa-f]{15}/g;
    }

    isEncrypted(filePath)
    {
        let lines = fs.readFileSync(filePath).toString().split(/\r?\n/);
        if( lines.length > 0 )
        {
            let matches = lines[0].match( this.headerRegex );
            return matches != null;
        }
        return false;
    }

    vault(filePath, passphrase)
    {
        if( this.isEncrypted(filePath) )
        {
            throw new Error(`File is already encrypted: ${filePath}`);
        }

        let key = this.generateKeyFromPhrase(passphrase);
        let content = fs.readFileSync(filePath);
        
        let buffer = `baker-vault:${version}:${this.iv.toString('hex')}\n`;
        buffer += this.encryptWithKey(content, key, this.iv);

        fs.writeFileSync(filePath, buffer);

        return key.toString('hex');
    }

    retrieve(filePath, passphrase)
    {
        if( this.isEncrypted(filePath) )
        {
            let lines = fs.readFileSync(filePath).toString().split(/\r?\n/);
            let key = this.generateKeyFromPhrase(passphrase);
            let iv = Buffer.from(lines[0].split(':')[2],'hex');

            return this.decryptWithKey(lines[1],key,iv);
        }
        throw new Error(`File is not encrypted: ${filePath}`);
    }

    encryptWithKey(text, key, iv) {
        let cipher = crypto.createCipheriv(this.algorithm, key, iv )
        let crypted = cipher.update(text,'utf8','hex')
        crypted += cipher.final('hex');
        return crypted;
    }
    
    generateKeyFromPhrase(passphrase)
    {
        return crypto.pbkdf2Sync(passphrase, this.salt, 100000, 32, 'sha512');
    }
    
    decryptWithKey(text, key, iv) 
    {
        let decipher = crypto.createDecipheriv(this.algorithm, key, iv)
        let dec = decipher.update(text,'hex','utf8')
        dec += decipher.final('utf8');
        return dec;
    }
}

module.exports = VaultLib;

