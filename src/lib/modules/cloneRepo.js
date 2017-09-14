'use strict';

module.exports = function(dep) {
    let result = {};

    result.cloneRepo = async function(repoURL) {
        const { child_process, path, git } = dep;

        let name = path.basename(repoURL);
        name = name.slice(-4) === '.git' ? name.slice(0, -4) : name; // Removing .git from the end
        let dir = path.resolve(process.cwd());

        return new Promise((resolve, reject)=>{
            git(dir).silent(true).clone(repoURL, (err, data)=>{
                if(err) reject(`A directory with same name as this repository exists in current directory.`);
                else resolve(path.join(dir, name));
            })
        });
    };

    return result;
};
