const _ = require('lodash');
const chalk = require('chalk');
const diff = require('diff');

const handlers = {
  differences: (logger, orig = {}, curr = {}) => {
    const showUnchanged = false;
    const differences =
      orig.length === 1 && curr.length === 1
        ? diff.diffJson(orig[0], curr[0])
        : diff.diffJson(orig, curr);

    let diffOut = '';
    let diffCount = 0;
    differences.forEach(part => {
      const value = part.value
        .split('\n')
        .map(line => line.replace(/,$/, '').replace(/"/g, ''))
        .join('\n');

      let color = 'grey';
      if (part.added) {
        color = 'green';
        diffCount += part.count;
      } else if (part.removed) {
        color = 'red';
        diffCount += part.count;
      }

      if (showUnchanged || part.added || part.removed) {
        // process.stderr.write(`  ${chalk[color](part.value).trim()}`);
        diffOut += `${chalk[color](value)}`;
      }
    });

    if (diffCount > 0) {
      diffOut = diffOut.split('\n').slice(0, -1).join('\n');
      logger.debug(`${diffCount} state differences:`, `\n${diffOut}`);
    }
    return logger;
  }
};

let logLevel;
const handler = {
  apply(logger) {
    if (!logger || !logger.getLogger) {
      throw new TypeError('Argument is not a root loglevel object');
    }

    if (logLevel) {
      throw new Error('You can assign a plugin only one time');
    }
    logLevel = logger;
    const { getLogger } = logger;

    const handle = (name, ...data) => handlers[name](logger, ...data);

    _.extend(logger, {
      handle,
      getLogger: name => {
        const newLogger = getLogger(name);
        return _.extend(newLogger, {
          handle: (handlerName, ...data) => handlers[handlerName](newLogger, ...data)
        });
      }
    });

    logger.setLevel(logger.getLevel());
    return logger;
  }
};

module.exports = handler;
