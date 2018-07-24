const git           = require('simple-git');
const path          = require('path');

class Git {
    constructor() {}

    static async clone(repoURL) {
        let name = path.basename(repoURL);
        name = name.slice(-4) === '.git' ? name.slice(0, -4) : name; // Removing .git from the end
        let dir = path.resolve(process.cwd());

        return new Promise((resolve, reject) => {
            git(dir).silent(true).clone(repoURL, (err, data) => {
                if (err)
                    reject(err);
                else
                    resolve(path.join(dir, name));
            });
        });
    }
}

module.exports = Git;
