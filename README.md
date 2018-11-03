### Baker community survey 🍞⁉️
If you have time, please answer few short questions to help us improve Baker: [community survey](https://goo.gl/forms/ffEyDVwQcI96Nt5c2)

# Baker 🍞 | [![dependencies Status](https://david-dm.org/ottomatica/Baker/status.svg)](https://david-dm.org/ottomatica/Baker)

Meet Baker! -- a simple tool for provisioning virtual machines and containers. With Baker you can quickly create development environments and run your code. With one tool, you have the functionality of vagrant, docker, ansible, and task runners like grunt.

See a running demo below:
[![asciicast](https://asciinema.org/a/lfb4aYpmtkHw6DLVFGjsdtaWu.png)](https://asciinema.org/a/lfb4aYpmtkHw6DLVFGjsdtaWu)

For more details, checkout [docs.getbaker.io](https://docs.getbaker.io/) and join our [Slack](https://getbaker.io/slack).

## Install from source

``` bash
git clone https://github.com/ottomatica/Baker
cd Baker
npm install
npm link
```

Also see other [binary installation options](https://docs.getbaker.io/installation/).
## Using Baker

Baker uses a configuration file (baker.yml) in the root directory of you project. This is an example of a baker.yml file. By running `baker bake` Baker provisions a VM with nodejs installed, and the specified ip address and port forwarding rules configured for you. You can access the VM by running `baker ssh` or run commands inside the VM with `baker run <Command Name>`. Your code is accessible in the VM via a shared folder.

``` yaml
---
name: baker-test
vm:
  ip: 192.168.22.22
  ports: 8000
lang:
  - nodejs9
commands:
  serve: cd /baker-test/deployment/express && npm install && node index.js
```

You can also point to a git repository with a baker.yml file, and and Baker will do the rest:

```
$ baker bake --repo https://github.com/ottomatica/baker-test.git
```

Baker also supports creating environments inside containers that do not require a VM.

``` yaml
name: baker-docs
container: 
  ports: 8000
lang:
  - python2
commands:
  build: mkdocs build
  serve: mkdocs serve -a 0.0.0.0:8000
  gh-deploy: mkdocs gh-deploy
```

Setting up a Java environment with MySQL can be done easily.
``` yaml
name: onboard
vm:
  ip: 192.168.8.8
  ports: 8080
vars:
  - mysql_password:
      prompt: Type your password for mysql server
tools:
  - maven
services:
  - mysql:
      version: 8
      service_conf: env/templates/mysql.cfg
      client_conf: env/templates/my.cnf
lang:
  - java8
config:
  - template: 
      src: env/templates/hibernate-template.cfg.xml 
      dest: /Onboarding/CoffeeMaker/src/main/resources/hibernate.cfg.xml
commands:
  serve: cd CoffeeMaker && mvn spring-boot:run
  debug: cd CoffeeMaker && mvnDebug spring-boot:run
  test: cd CoffeeMaker && mvn test
```
