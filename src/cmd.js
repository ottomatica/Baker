#!/usr/bin/env node
'use strict'

const { join, resolve } = require('path')
const yargs = require('yargs')
const { homepage, version } = require(join(__dirname, './package.json'))
const { commands } = require('./baker.js')

// Switch CWD if specified from options
const cwd = resolve(yargs.argv.cwd || process.cwd())
process.chdir(cwd)

// Init CLI commands and options
commands.forEach(cmd => yargs.command(cmd.command, cmd.desc, cmd.builder, cmd.handler))
yargs
  .help()
  .options({ cwd: { desc: 'Change the current working directory' } })
  .demand(1)
  .epilog((homepage ? `| Documentation: ${homepage}\n` : '') + (version ? `| Version: ${version}` : ''))
  .argv
