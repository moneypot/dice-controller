(Don't feel like maintaining this while I'm just taking inventory of the steps to run set up dice-controller, so I moved more writing here.)

## Tutorial for game developers

The `dice-controller` project demonstrates how to customize a `@moneypot/caas` instance to run your own
controller service (from here on referred to as CAAS, i.e. controller as a service).

### How does the Moneypot ecosystem work?

(See: README_MONEYPOT.md)

### What is `dice-controller`?

Our CAAS server (`dice-controller`) is a customized instance of a `@moneypot/caas` server which we publish as a library on NPM.

Our CAAS server uses plugins to do things such as:

1. Extend the CAAS database with new tables (like a "dice bets" table)
2. Extend the GraphQL API with:
   - Custom queries (like "get me the user's latest 10 dice bets)
   - Custom mutations (like "make a 0.0001 BTC dice bet")

### Set up `dice-controller` database

You'll need Node installed. Then clone this project locally and run `npm install` in the project directory.

Create a Postgres database that will store data for your CAAS server (e.g. users, balances, transfers, bets, etc).

```
createdb dice-controller
```

Now create a `app_postgraphile` user with a random password. That username is required for the `DATABASE_URL` config to work.

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- So we can use gen_random_uuid()

-- Create user "app_postgres"
CREATE ROLE app_postgraphile LOGIN PASSWORD 'secret';
DO $$
DECLARE
  pass text;
BEGIN
  pass := gen_random_uuid()::text;
  EXECUTE 'CREATE ROLE my_user LOGIN PASSWORD ' || quote_literal(pass);
  RAISE NOTICE 'Password for app_postgraphile is: %', pass;
END$$;

-- If you don't already have a superuser for your database, you can run this.
DO $$
DECLARE
  pass text;
BEGIN
  pass := gen_random_uuid()::text;
  EXECUTE 'CREATE ROLE app_superuser WITH LOGIN SUPERUSER PASSWORD ' || quote_literal(pass);
  RAISE NOTICE 'Password for superuser is: %', pass;
END$$;
```

Copy the `.env.example` file, rename it to `.env`, and update its values to point at your server.

(Note: your `.env` file will contain secrets, so avoid exposing it or committing it to a public github repo.)

```ini
DATABASE_URL=postgresql://app_postgraphile:00000000-0000-0000-0000-000000000000@localhost:5432/dice-controller
SUPERUSER_DATABASE_URL=postgresql://user:pass@localhost:5432/dice-controller
```

### Add a casino and controller

```sql
insert into caas.bankrolls (casino_id, currency, amount) values
 -- dev bankroll for dev controller
 ('00000000-0000-0000-0000-444444444444', 'BTC', 100000000)
,('00000000-0000-0000-0000-444444444444', 'TBTC', 100000000)
 -- prod bankroll for prod controller
,('00000000-0000-0000-0000-555555555555', 'BTC', 100000000)
,('00000000-0000-0000-0000-555555555555', 'TBTC', 100000000)
;
```

### Run

```sh
npm run start
```

This will first apply @moneypot/caas core database migrations and then run your migrations, if any.

Then it will boot the server and begin polling your controller(s) on any Moneypot casinos that you inserted into the `caas_secret.casinos` table.
