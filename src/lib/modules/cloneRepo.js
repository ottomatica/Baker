'use strict'

module.exports = function (dep) {
  let result = {}

  result.cloneRepo = function (repoURL) {
    const { child_process, path } = dep

    let name = path.basename(repoURL);
    name = name.slice(-4) === '.git' ? name.slice(0,-4): name; // Removing .git from the end
    let dir = path.resolve(process.cwd());

    child_process.execSync(`git clone ${repoURL}`, { stdio: 'inherit' });
    return `${path.join(dir, name)}`;
  }

  return result
}
