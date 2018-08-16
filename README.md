# Baker

Meet Baker! -- a simple tool for provisioning virtual machines and containers. With Baker you can quickly create development environments and run your code. With one tool, you have the functionality of vagrant, docker, ansible, and task runners like grunt.

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

You can also point to a git repository with a baker.yml file, and and Baker will do the rest rest:

```
$ baker bake --repo https://github.com/ottomatica/baker-test.git
```

[![asciicast](https://asciinema.org/a/S3xtkL2FvnINO4IkQCCja5BTX.png)](https://asciinema.org/a/S3xtkL2FvnINO4IkQCCja5BTX)

For more details, checkout [docs.getbaker.io](https://docs.getbaker.io/).
