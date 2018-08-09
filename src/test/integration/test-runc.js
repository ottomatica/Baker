const child_process = require('child_process');
const request = require('request');
const chai = require('chai');
const expect = chai.expect;
const os = require('os');
const path = require('path');
const fs = require('fs-extra');

describe('baker should create runc baker container', function() {
    this.timeout(1000000);

    // https://github.ncsu.edu/engr-csc326-staff/Onboarding
    const tstDir = path.join(os.homedir(), 'Library', 'Baker', 'int-test');
    const containerDir = path.join(tstDir, 'test-runc');

    it('should make baker container', function(done) {

        fs.mkdirpSync(containerDir);
        fs.copyFileSync('test/resources/persistent/baker.yml', `${containerDir}/baker.yml`);

        // echo value for prompt input for password.
        var child = child_process.exec('baker bake -v',
                                       {cwd: containerDir }, function(error, stdout, stderr) {

            expect(stdout).to.not.include("failed");
            done();
        });
        child.stdout.pipe(process.stdout);
    });

    it('should destroy chroot', function(done) {
        var child = child_process.exec(`cd ${containerDir} && baker destroy`, function(error, stdout, stderr)
        {
            console.log(stderr);
            expect(stderr).to.be.empty;
            done();
        });
        child.stdout.pipe(process.stdout);
    });

});
