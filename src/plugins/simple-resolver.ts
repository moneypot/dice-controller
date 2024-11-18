import { gql, makeExtendSchemaPlugin } from "postgraphile/utils";

// Resolver plugins are the simplest way to add queries and mutations to your GraphQL API.

type Todo = {
  id: number;
  text: string;
};

const database = {
  nextId: 10,
  fortunes: [
    { id: 0, text: "You will find a new friend soon." },
    { id: 1, text: "A pleasant surprise is waiting for you." },
    { id: 2, text: "Your hard work will pay off in the near future." },
    { id: 3, text: "An exciting opportunity will present itself to you." },
    { id: 4, text: "You will overcome a significant challenge." },
    { id: 5, text: "A long-lost acquaintance will reenter your life." },
    { id: 6, text: "Your creativity will lead you to success." },
    { id: 7, text: "A journey of a thousand miles begins with a single step." },
    { id: 8, text: "Your kindness will be repaid tenfold." },
    { id: 9, text: "Good fortune will be yours in the coming months." },
  ],
  insertFortune: async (text: string): Promise<Todo> => {
    const id = database.nextId++;
    const todo: Todo = { id, text };
    database.fortunes.push(todo);
    return todo;
  },
  getFortuneById: async (id: number): Promise<Todo | null> => {
    const todo = database.fortunes[id];
    return todo || null;
  },
};

export const SimpleResolverPlugin = makeExtendSchemaPlugin(() => {
  return {
    typeDefs: gql`
      type Fortune {
        id: Int!
        text: String!
      }

      extend type Query {
        randomFortune: Fortune
      }

      extend type Mutation {
        addFortune(text: String!): Fortune
      }
    `,
    resolvers: {
      Mutation: {
        addFortune: async (_, args) => {
          const { text } = args;
          return database.insertFortune(text);
        },
      },
      Query: {
        randomFortune: async () => {
          const id = Math.floor(Math.random() * database.fortunes.length);
          return database.getFortuneById(id);
        },
      },
    },
  };
});
