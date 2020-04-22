const { graphiqlExpress } = require('graphql-server-express');

module.exports = graphiqlExpress({
  endpointURL: '/graphql',
  query: '{\n' + '  reports {\n' + '    id,\n' + '    type,\n' + '    title\n' + '  }\n' + '}'
});
