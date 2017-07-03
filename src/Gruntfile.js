module.exports = function(grunt) {
    grunt.loadNpmTasks('innosetup-compiler');
    grunt.initConfig({
        innosetup_compiler: {
            your_target: {
                options: {
                    gui: false,
                    verbose: true,
                    // signtoolname: 'signtool',
                    // signtoolcommand: '"path/to/signtool.exe" sign /f "C:\\absolute\\path\\to\\mycertificate.pfx" /t http://timestamp.globalsign.com/scripts/timstamp.dll /p "MY_PASSWORD" $f'
                },
                script: 'baker.iss'
            }
        }
    });
};
