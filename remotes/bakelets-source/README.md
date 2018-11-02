# Bakelets

Repository for storing scripts, roles, and playbooks


### Development 

To add as a subtree to baker.

```
git remote add bakelets-source https://github.com/ottomatica/bakelets-source.git 
```

To update the subtree.
```
git subtree pull --prefix src/remotes/bakelets-source/ bakelets-source master
```

If there is no subtree present (e.g. first time):
```
git subtree add --prefix src/remotes/bakelets-source/ bakelets-source master
```
