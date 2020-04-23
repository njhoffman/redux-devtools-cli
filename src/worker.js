const SCWorker = require('socketcluster/scworker');
const express = require('express');

const app = express();
const routes = require('./routes');
const createStore = require('./store');
const logger = require('./logger');

const isJson = str => {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
};

class Worker extends SCWorker {
  run() {
    const { httpServer } = this;
    const { scServer } = this;
    const { options } = this;
    const store = createStore(options);

    httpServer.on('request', app);

    app.use(routes(options, store, scServer));

    let prevState;
    scServer.addMiddleware(scServer.MIDDLEWARE_EMIT, (req, next) => {
      const channel = req.event;
      const { data } = req;
      if (channel.substr(0, 3) === 'sc-' || channel === 'respond' || channel === 'log') {
        const { type, id, payload, action, nextActionId } = data;
        if (type === 'ACTION') {
          const state = isJson(payload) ? JSON.parse(payload) : payload;
          const parsedAction = JSON.parse(action);
          const { type: actionType, ...rest } = parsedAction;
          const actionLogger = logger.getLogger(actionType);
          actionLogger.info(`${id} #${nextActionId - 1}`, rest);
          actionLogger.handle('differences', prevState, state);
          prevState = state;
        }
        scServer.exchange.publish(channel, data);
      } else if (channel === 'log-noid') {
        scServer.exchange.publish('log', { id: req.socket.id, data });
      }
      next();
    });

    scServer.addMiddleware(scServer.MIDDLEWARE_SUBSCRIBE, function (req, next) {
      next();
      if (req.channel === 'report') {
        store
          .list()
          .then(data => {
            req.socket.emit(req.channel, { type: 'list', data });
          })
          .catch(error => {
            console.error(error); // eslint-disable-line no-console
          });
      }
    });

    scServer.on('connection', socket => {
      let channelToWatch;
      let channelToEmit;
      // clientsCount, url, headers: { host }, origins,
      const {
        server: { appName },
        id,
        remoteAddress
      } = socket;
      logger.info(`Connected to ${id} ${remoteAddress} with app ${appName}`);

      socket.on('login', function (credentials, respond) {
        if (credentials === 'master') {
          channelToWatch = 'respond';
          channelToEmit = 'log';
        } else {
          channelToWatch = 'log';
          channelToEmit = 'respond';
        }

        logger.info(
          `Logged in, watching channel: ${channelToWatch}, emitting on: ${channelToEmit}`
        );

        this.exchange.subscribe(`sc-${socket.id}`).watch(msg => {
          logger.debug(`Emitting to channel ${channelToWatch}:`, msg);
          socket.emit(channelToWatch, msg);
        });

        respond(null, channelToWatch);
      });

      socket.on('getReport', (reportId, respond) => {
        store
          .get(reportId)
          .then(data => {
            respond(null, data);
          })
          .catch(error => {
            console.error(error); // eslint-disable-line no-console
          });
      });

      socket.on('disconnect', function () {
        logger.info(`Disconnecting ${socket.id}`);
        const channel = this.exchange.channel(`sc-${socket.id}`);
        channel.unsubscribe();
        channel.destroy();
        scServer.exchange.publish(channelToEmit, {
          id: socket.id,
          type: 'DISCONNECTED'
        });
      });
    });
  }
}

new Worker();
