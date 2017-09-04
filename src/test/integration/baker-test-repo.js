const child_process = require('child_process');
const request = require('request');
const chai = require('chai');
const expect = chai.expect;


describe('Command line tests', function() {
});

describe('baker should create VM and destroy it', function() {
    this.timeout(600000);
    
    it('should have running node server', function(done) 
    {
        var child = child_process.exec('node baker.js --local test/resources/baker-test', function(error, stdout, stderr){

            var options = {
                url: "http://localhost:3333/",
                method: 'GET'
            };
        
            // Send a http request to url and specify a callback that will be called upon its return.
            request(options, function (error, response, body) 
            {
                expect(body).to.equal('Hi there!');
                done();
            });
        
        });
        child.stdout.pipe(process.stdout);
    });

    it('should destroy VM', function(done) 
    {
        var child = child_process.exec('node baker.js --destroy baker-test', function(error, stdout, stderr)
        {
            console.log(stderr);
            expect(stderr).to.be.empty;
            done();
        });
        child.stdout.pipe(process.stdout);
    });

});