let child_process = require('child_process');
let platform = process.platform;

module.exports = function (grunt) {
    if(platform === 'win32'){
        // Building installer for windows (inno setup)
        child_process.execSync('npm run build-win')
        grunt.loadNpmTasks('innosetup-compiler');
        grunt.initConfig({
            innosetup_compiler: {
                your_target: {
                    options: {
                        gui: false,
                        verbose: false,
                        O: './installers/win/bin/'
                        // signtoolname: 'signtool',
                        // signtoolcommand: '"path/to/signtool.exe" sign /f "C:\\absolute\\path\\to\\mycertificate.pfx" /t http://timestamp.globalsign.com/scripts/timstamp.dll /p "MY_PASSWORD" $f'
                    },
                    script: './installers/win/scripts/baker.iss'
                }
            }
        });
        grunt.registerTask("default", ["innosetup_compiler"]);
    } else if(platform === 'darwin'){
        // Building installer for Mac (pkgbuild)
        grunt.registerTask('default', function() {
            child_process.execSync('npm run build-macos && bash ./installers/macos/package.sh');
        });
    }
};
