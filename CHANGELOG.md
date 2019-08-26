# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.7.2](https://github.com/ottomatica/Baker/compare/v0.7.1...v0.7.2) (2019-08-26)


### Build System

* **deps:** [Security] Bump lodash.template from 4.4.0 to 4.5.0 ([#160](https://github.com/ottomatica/Baker/issues/160)) ([d0c7c29](https://github.com/ottomatica/Baker/commit/d0c7c29))
* **deps:** Bump inquirer to 7.0.0 ([#178](https://github.com/ottomatica/Baker/issues/178)) ([4b8cd20](https://github.com/ottomatica/Baker/commit/4b8cd20))
* **deps:** Bump mustache from 3.0.1 to 3.0.2 ([#177](https://github.com/ottomatica/Baker/issues/177)) ([c37bce7](https://github.com/ottomatica/Baker/commit/c37bce7))
* **deps:** Bump node-vagrant from 1.3.9 to 1.3.10 ([#176](https://github.com/ottomatica/Baker/issues/176)) ([12e1212](https://github.com/ottomatica/Baker/commit/12e1212))
* **deps:** Bump simple-git to 1.124.0 ([#172](https://github.com/ottomatica/Baker/issues/172)) ([be21037](https://github.com/ottomatica/Baker/commit/be21037))
* **deps:** Bump ssh2 from 0.8.4 to 0.8.5 ([#162](https://github.com/ottomatica/Baker/issues/162)) ([40b6c9a](https://github.com/ottomatica/Baker/commit/40b6c9a))
* **deps:** Bump validator from 11.0.0 to 11.1.0 ([#157](https://github.com/ottomatica/Baker/issues/157)) ([478e779](https://github.com/ottomatica/Baker/commit/478e779))
* **deps:** Bump yargs to 14.0.0 ([#175](https://github.com/ottomatica/Baker/issues/175)) ([b12ae79](https://github.com/ottomatica/Baker/commit/b12ae79))
* **deps-dev:** Bump commitizen to 4.0.3 ([#170](https://github.com/ottomatica/Baker/issues/170)) ([cac2acd](https://github.com/ottomatica/Baker/commit/cac2acd))
* **deps-dev:** Bump cz-conventional-changelog to 3.0.2 ([#169](https://github.com/ottomatica/Baker/issues/169)) ([12e90c5](https://github.com/ottomatica/Baker/commit/12e90c5))
* **deps-dev:** Bump innosetup-compiler from 5.5.62 to 5.6.1 ([#171](https://github.com/ottomatica/Baker/issues/171)) ([b22da56](https://github.com/ottomatica/Baker/commit/b22da56))
* **deps-dev:** Bump mocha from 6.1.4 to 6.2.0 ([#167](https://github.com/ottomatica/Baker/issues/167)) ([2c596ff](https://github.com/ottomatica/Baker/commit/2c596ff))
* **deps-dev:** Bump standard-version from 6.0.1 to 7.0.0 ([#173](https://github.com/ottomatica/Baker/issues/173)) ([8f81226](https://github.com/ottomatica/Baker/commit/8f81226))



### [0.7.1](https://github.com/ottomatica/Baker/compare/v0.7.0...v0.7.1) (2019-07-02)


### Bug Fixes

* **build:** fixing .deb script (rm vagrant dependency) ([0570993](https://github.com/ottomatica/Baker/commit/0570993))


### Build System

* **deps:** Bump bluebird from 3.5.4 to 3.5.5 ([#146](https://github.com/ottomatica/Baker/issues/146)) ([558b3ea](https://github.com/ottomatica/Baker/commit/558b3ea))
* **deps:** Bump configstore from 4.0.0 to 5.0.0 ([#148](https://github.com/ottomatica/Baker/issues/148)) ([c4e9c09](https://github.com/ottomatica/Baker/commit/c4e9c09))
* **deps:** Bump fs-extra to 8.1.0 ([#154](https://github.com/ottomatica/Baker/issues/154)) ([9cb5f12](https://github.com/ottomatica/Baker/commit/9cb5f12))
* **deps:** Bump inquirer to 6.4.1 ([#153](https://github.com/ottomatica/Baker/issues/153)) ([d2408b4](https://github.com/ottomatica/Baker/commit/d2408b4))
* **deps:** Bump node-virtualbox to 0.2.3 ([#152](https://github.com/ottomatica/Baker/issues/152)) ([c7de810](https://github.com/ottomatica/Baker/commit/c7de810))
* **deps:** Bump simple-git to 1.117.0 ([#155](https://github.com/ottomatica/Baker/issues/155)) ([ee83b49](https://github.com/ottomatica/Baker/commit/ee83b49))
* **deps:** Bump validator from 10.11.0 to 11.0.0 ([#145](https://github.com/ottomatica/Baker/issues/145)) ([770486b](https://github.com/ottomatica/Baker/commit/770486b))
* **deps:** Bump yargs from 13.2.2 to 13.2.4 ([#141](https://github.com/ottomatica/Baker/issues/141)) ([d58cbb6](https://github.com/ottomatica/Baker/commit/d58cbb6))
* **deps-dev:** Bump pkg from 4.3.8 to 4.4.0 ([#142](https://github.com/ottomatica/Baker/issues/142)) ([d358eee](https://github.com/ottomatica/Baker/commit/d358eee))
* **deps-dev:** Bump standard-version from 5.0.2 to 6.0.1 ([#138](https://github.com/ottomatica/Baker/issues/138)) ([145b964](https://github.com/ottomatica/Baker/commit/145b964))



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
