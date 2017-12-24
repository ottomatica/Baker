// Can handle java8 by looking up

class Java {
    
    constructor(bakerletsPath, version) {
        this.bakerletsPath = bakerletsPath;
        this.version = version;
    }

    load()
    {
        console.log("load", this.bakerletsPath, this.version);
    }

}

module.exports = Java;