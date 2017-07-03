let child_process = require('child_process');

module.exports = function (grunt) {
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
};
