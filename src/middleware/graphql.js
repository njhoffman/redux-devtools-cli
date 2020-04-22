const { graphqlExpress } = require('graphql-server-express');
const schema = require('../api/schema');

module.exports = function(store) {
  return graphqlExpress(function() {
    return {
      schema,
      context: {
        store
      }
    };
  });
};
