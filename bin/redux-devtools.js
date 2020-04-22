#! /usr/bin/env node
const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const chalk = require('chalk');
const injectServer = require('./injectServer');
const getOptions = require('../src/options');
const server = require('../index');
const open = require('./open');

const options = getOptions(argv);

function readFile(filePath) {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf-8');
}

if (argv.protocol === 'https') {
  argv.key = argv.key ? readFile(argv.key) : null;
  argv.cert = argv.cert ? readFile(argv.cert) : null;
}

function log(pass, msg) {
  const prefix = pass ? chalk.green.bgBlack('PASS') : chalk.red.bgBlack('FAIL');
  const color = pass ? chalk.blue : chalk.red;
  console.log(prefix, color(msg)); // eslint-disable-line no-console
}

function getModuleName(type) {
  switch (type) {
    case 'macos':
      return 'react-native-macos';
    // react-native-macos is renamed from react-native-desktop
    case 'desktop':
      return 'react-native-desktop';
    case 'reactnative':
    default:
      return 'react-native';
  }
}

function getModulePath(moduleName) {
  return path.join(process.cwd(), 'node_modules', moduleName);
}

function getModule(type) {
  let moduleName = getModuleName(type);
  let modulePath = getModulePath(moduleName);
  if (type === 'desktop' && !fs.existsSync(modulePath)) {
    moduleName = getModuleName('macos');
    modulePath = getModulePath(moduleName);
  }
  return {
    name: moduleName,
    path: modulePath
  };
}

function injectRN(type, msg) {
  const module = getModule(type);
  const fn = type === 'revert' ? injectServer.revert : injectServer.inject;
  const pass = fn(module.path, options, module.name);
  log(
    pass,
    msg +
      (pass ? '.' : `, the file \`${path.join(module.name, injectServer.fullPath)}\` not found.`)
  );

  process.exit(pass ? 0 : 1);
}

if (argv.revert) {
  injectRN(argv.revert, 'Revert injection of ReduxDevTools server from React Native local server');
}
if (argv.injectserver) {
  injectRN(argv.injectserver, 'Inject ReduxDevTools server into React Native local server');
}

server(argv).then(function(r) {
  if (argv.open && argv.open !== 'false') {
    r.on('ready', function() {
      open(argv.open, options);
    });
  }
});
