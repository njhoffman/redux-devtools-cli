const path = require('path');
const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const graphiqlMiddleware = require('./middleware/graphiql');
const graphqlMiddleware = require('./middleware/graphql');

const app = express.Router();

const serveUmdModule = name => {
  app.use(
    express.static(
      `${require.resolve(name).match(/.*\/(?:(node_modules|packages)\/[^/]+\/)?/)[0]}umd`
    )
  );
};

const routes = (options, store, scServer) => {
  const limit = options.maxRequestBody;
  const { logHTTPRequests } = options;

  if (logHTTPRequests) {
    if (typeof logHTTPRequests === 'object') app.use(morgan('combined', logHTTPRequests));
    else app.use(morgan('combined'));
  }

  app.use('/graphiql', graphiqlMiddleware);

  serveUmdModule('react');
  serveUmdModule('react-dom');
  serveUmdModule('redux-devtools-core');

  app.get('/port.js', function(req, res) {
    res.send(`reduxDevToolsPort = ${options.port}`);
  });
  app.get('*', function(req, res) {
    res.sendFile(path.join(__dirname, '../app/index.html'));
  });

  app.use(cors({ methods: 'POST' }));
  app.use(bodyParser.json({ limit }));
  app.use(bodyParser.urlencoded({ limit, extended: false }));

  app.use('/graphql', graphqlMiddleware(store));

  app.post('/', function(req, res) {
    if (!req.body) return res.status(404).end();
    switch (req.body.op) {
      case 'get':
        store
          .get(req.body.id)
          .then(function(r) {
            res.send(r || {});
          })
          .catch(function(error) {
            console.error(error); // eslint-disable-line no-console
            res.sendStatus(500);
          });
        break;
      case 'list':
        store
          .list(req.body.query, req.body.fields)
          .then(function(r) {
            res.send(r);
          })
          .catch(function(error) {
            console.error(error); // eslint-disable-line no-console
            res.sendStatus(500);
          });
        break;
      default:
        store
          .add(req.body)
          .then(function(r) {
            res.send({ id: r.id, error: r.error });
            scServer.exchange.publish('report', {
              type: 'add',
              data: r
            });
          })
          .catch(function(error) {
            console.error(error); // eslint-disable-line no-console
            res.status(500).send({});
          });
    }
  });
  return app;
};

module.exports = routes;
