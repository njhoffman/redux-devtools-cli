const { makeExecutableSchema } = require('graphql-tools');
const requireSchema = require('../utils/requireSchema');

const schema = requireSchema('./schema_def.graphql', require);

const resolvers = {
  Query: {
    reports: function report(source, args, context) {
      return context.store.listAll();
    },
    report: function report(source, args, context) {
      return context.store.get(args.id);
    }
  }
};

const executableSchema = makeExecutableSchema({
  typeDefs: schema,
  resolvers
});

module.exports = executableSchema;
