# How to contribute to Baker 🍞

## Reporting bugs

If you're not able to find an open issue about the same bug, open a new one. Be sure to include a clear title, complete the issue template with as much detail as possible.

## Suggesting enhancements

You can use GitHub issue tracker to submit an enhancement suggestions for Baker. This can include completely new features, or minor improvement to current functionality.

## Contributing to source code

If you want to contribute to Baker source code but you are not sure where to start, see #enhancement and #bug issues that you might be able to address. If you have an idea for enhancement, before you start implementing the enhancement, make sure to open an issue and discuss about the idea with organizers. This will help make sure the enhancement that you want to work on is a right addition in accordance with goals of this project.

### Commit messages

We use [conventional commit message format](https://www.conventionalcommits.org/en/v1.0.0-beta.2/) to be able to auto-generate our changelog. Conventional commit message format is `<type>[optional scope]: <description>`. The type can be `fix | feat | BREAKING CHANGE | chore | docs | style | refactor | build` and the _optional_ scope can be `bakelet | module` or anything else that would make sense. A simple example for updating a dependency is `build(deps): Bump X from 1.2.0 to 1.3.0`.

You can also use multiple types, for example if adding a `feat` that is also a `BREAKING CHANGE`, your commit message can be:

```
feat: allow provided config object to extend other configs

BREAKING CHANGE: `extends` key in config file is now used for extending other config files

fixes #12
```

To help with writing these longer commit messages and for consistency, we have a dev-dependency ([commitizen](https://github.com/commitizen/cz-cli)). If you choose to use commitizen for writing your commit messages, simply run `npm run commit` and it will ask you to fill in some information and then commits your changes for you!

### Pull Request

Implemented a feature enhacement or fixed a bug? Open a PR and make sure to complete the PR template with as much details as possible. One of the organizers will review your proposed changes and respond to your PR.

> **Note:** By contributing you agree that your contributions are your own work and approved by your employer. You grant complete irrevocable copyright permission to users and developers of this project in the present and future, in accordance with the license.
