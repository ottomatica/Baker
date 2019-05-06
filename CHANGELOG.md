# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [0.7.0](https://github.com/ottomatica/Baker/compare/v0.6.15...v0.7.0) (2019-05-05)


### Bug Fixes

* Upgrade node-virtualbox to add VirtBox 6 support ([ottomatica/node-virtualbox#27](https://github.com/ottomatica/node-virtualbox/pull/27)) ([faeb715](https://github.com/ottomatica/node-virtualbox/commit/faeb715f7a59b831511bedacb329f5c86d818d00)), closes [#119](https://github.com/ottomatica/Baker/issues/119)
* Fixed invalid imports ([#91](https://github.com/ottomatica/Baker/issues/91)) ([ebda70c](https://github.com/ottomatica/Baker/commit/ebda70c)), closes [#90](https://github.com/ottomatica/Baker/issues/90)
* Update node-virtualbox to enable symlinks in shared folder ([85fa44b](https://github.com/ottomatica/Baker/commit/85fa44b))
* Update validator logic to not need drivelist dependency ([8af6f89](https://github.com/ottomatica/Baker/commit/8af6f89))


### Features

* Better error message + suggestion for invalid Bakelet names ([145ece9](https://github.com/ottomatica/Baker/commit/145ece9)), closes [#101](https://github.com/ottomatica/Baker/issues/101)
* Arch Linux PKGBUILD ([#120](https://github.com/ottomatica/Baker/pull/120)) ([59f5e81](https://github.com/ottomatica/Baker/commit/59f5e81)), closes [#115](https://github.com/ottomatica/Baker/issues/115)


<a name="0.6.15"></a>
## 0.6.15 (2018-11-26)

### Features

* Add python3.6 Bakelet ([2e52f01](https://github.com/ottomatica/Baker/commit/2e52f01))

<a name="0.6.14"></a>
## 0.6.14 (2018-11-25)

### Bug Fixes

* **bakelets:** Fix R Bakelet to work when no packages are provided ([b07c20e](https://github.com/ottomatica/Baker/commit/b07c20e)), closes [#69](https://github.com/ottomatica/Baker/issues/69)
* **providers:** Virtualbox stop command now stops instead of save state ([edde1a6](https://github.com/ottomatica/Baker/commit/edde1a6))

### Features

* Introducing _Vault_ ([235f144](https://github.com/ottomatica/Baker/commit/235f144))
* Add python3.6 Bakelet ([2e52f01](https://github.com/ottomatica/Baker/commit/2e52f01))
