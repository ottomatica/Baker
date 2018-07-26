const child_process = require('child_process');
const request = require('request');
const chai = require('chai');
const expect = chai.expect;
const os = require('os');
const path = require('path');
const fs = require('fs-extra');

describe('baker should create coffeemaker, run it, and destroy it', function() {
    this.timeout(1000000);

    // https://github.ncsu.edu/engr-csc326-staff/Onboarding
    const tstDir = path.join(os.homedir(), 'Library', 'Baker', 'int-test');
    const onboarding = path.join(tstDir, 'Onboarding');

    it('should run coffeemaker project', function(done) {

        fs.mkdirpSync(tstDir);
        fs.removeSync(onboarding);

        // echo value for prompt input for password.
        var child = child_process.exec('echo 326 | baker bake --repo git@github.ncsu.edu:engr-csc326-staff/Onboarding.git',
                                       {cwd: tstDir }, function(error, stdout, stderr) {

            expect(stdout).to.not.include("Host key verification failed", "You need to add ssh key to github.ncsu.edu in order to run this test.");

            setTimeout( function()
            {

                var options = {
                    url: "http://192.168.8.8:8080/api/v1/inventory",
                    method: 'GET'
                };

                request(options, function (error, response, body)
                {
                    console.log(error || body);
                    done();
                });

            },90000);

            console.log(`Waiting 90 seconds for coffeemaker to start springboot:run`);

        });
        child.stdout.pipe(process.stdout);
    });

    it('should destroy coffeemaker VM', function(done) {
        var child = child_process.exec(`cd ${onboarding} && baker destroy`, function(error, stdout, stderr)
        {
            console.log(stderr);
            expect(stderr).to.be.empty;
            done();
        });
        child.stdout.pipe(process.stdout);
    });

});
