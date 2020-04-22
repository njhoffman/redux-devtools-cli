const SCWorker = require('socketcluster/scworker');
const express = require('express');

const app = express();
const routes = require('./routes');
const createStore = require('./store');

class Worker extends SCWorker {
  run() {
    const { httpServer } = this;
    const { scServer } = this;
    const { options } = this;
    const store = createStore(options);

    httpServer.on('request', app);

    app.use(routes(options, store, scServer));

    scServer.addMiddleware(scServer.MIDDLEWARE_EMIT, function (req, next) {
      const channel = req.event;
      const { data } = req;
      if (channel.substr(0, 3) === 'sc-' || channel === 'respond' || channel === 'log') {
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
      console.log(`Connected to ${remoteAddress} with app ${appName} : ${id}`);

      socket.on('login', function (credentials, respond) {
        if (credentials === 'master') {
          channelToWatch = 'respond';
          channelToEmit = 'log';
        } else {
          channelToWatch = 'log';
          channelToEmit = 'respond';
        }
        this.exchange.subscribe(`sc-${socket.id}`).watch(msg => {
          socket.emit(channelToWatch, msg);
        });
        console.log(
          `Logged in, watching channel: ${channelToWatch}, emitting from ${channelToEmit}`
        );
        respond(null, channelToWatch);
      });

      socket.on('getReport', (id, respond) => {
        store
          .get(id)
          .then(data => {
            respond(null, data);
          })
          .catch(error => {
            console.error(error); // eslint-disable-line no-console
          });
      });

      socket.on('disconnect', function () {
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
