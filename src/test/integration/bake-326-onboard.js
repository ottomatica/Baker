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

    it('should run coffeemaker project', function(done) {

        const tstDir = path.join(os.homedir(), 'Library', 'Baker', 'int-test');
        fs.mkdirpSync(tstDir);
        const onboarding = path.join(tstDir, 'Onboarding');
        fs.removeSync(onboarding);

        // echo value for prompt input for password.
        var child = child_process.exec('echo 326 | baker bake --repo git@github.ncsu.edu:engr-csc326-staff/Onboarding.git',
                                       {cwd: tstDir }, function(error, stdout, stderr) {
            setTimeout( function()
            {
                expect(stderr).to.be.empty;

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

        });
        child.stdout.pipe(process.stdout);
    });

    /*it('should destroy VM', function(done) {
        var child = child_process.exec('node cmd.js destroy onboard', function(error, stdout, stderr)
        {
            console.log(stderr);
            expect(stderr).to.be.empty;
            done();
        });
        child.stdout.pipe(process.stdout);
    });
    */

});
