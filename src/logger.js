const _ = require('lodash');
const chalk = require('chalk');
const diff = require('diff');
const logger = require('loglevel');
const prefix = require('loglevel-plugin-prefix');

const handle = require('./handlers');

const config = {
  logLevel: 'trace',
  logPrefix: 'level'
};

const colors = {
  TRACE: chalk.magenta,
  DEBUG: chalk.cyan,
  INFO: chalk.blue,
  WARN: chalk.yellow,
  ERROR: chalk.red
};

const padRight = (input, len) => {
  const str = input && input.toString() ? input.toString() : '';
  return len > str.length ? str + new Array(len - str.length + 1).join(' ') : str;
};

const padZeros = (num, numZeros) => (Array(numZeros).join('0') + num).slice(-numZeros);

prefix.reg(logger);
logger.setLevel(config.logLevel);

const levelPrefix = (level, name, timestamp) =>
  `${chalk.gray(`[${timestamp}]`)} ${colors[level.toUpperCase()](
    padRight(level, 5)
  )} ${chalk.magenta(`${name}:`)}`;

const prefixes = { level: levelPrefix };

prefix.apply(logger, {
  format: prefixes[config.logPrefix],
  timestampFormatter: date =>
    `${date.toLocaleTimeString('en-US', { hour12: false })}.${padZeros(date.getMilliseconds(), 3)}`
});

prefix.apply(logger.getLogger('critical'), {
  format: (level, name, timestamp) => chalk.red.bold(`[${timestamp}] ${level} ${name}:`)
});

handle.apply(logger);

module.exports = logger;
