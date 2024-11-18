# dice-controller

A demo of how to use `@moneypot/caas` to create a basic controller service that implements a simple dice betting game.

## Steps to configure and run

```
createdb dice-controller
```

Now create a `app_postgraphile` user with a random password. That username is required for the `DATABASE_URL` config to work.

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- So we can use gen_random_uuid()

-- Create user "app_postgres"
DO $$
DECLARE
  pass text := gen_random_uuid();
BEGIN
  EXECUTE 'CREATE ROLE app_postgraphile LOGIN PASSWORD ' || quote_literal(pass);
  RAISE NOTICE 'Password for app_postgraphile is: %', pass;
END$$;

-- If you already did this step but you missed the password, you can update app_postgraphile's password with this:
DO $$
DECLARE
  pass text := gen_random_uuid();
BEGIN
  EXECUTE 'ALTER ROLE app_postgraphile WITH PASSWORD ' || quote_literal(pass);
  RAISE NOTICE 'New password for app_postgraphile is: %', pass;
END$$;

-- If you don't already have a superuser for your database, you can run this.
DO $$
DECLARE
  pass text := gen_random_uuid();
BEGIN
  EXECUTE 'CREATE ROLE app_superuser WITH LOGIN SUPERUSER PASSWORD ' || quote_literal(pass);
  RAISE NOTICE 'Password for app_superuser is: %', pass;
END$$;
```

Copy the `.env.example` file, rename it to `.env`, and update its values to point at your server.

(Note: your `.env` file will contain secrets, so avoid exposing it or committing it to a public github repo.)

```ini
DATABASE_URL=postgresql://app_postgraphile:00000000-0000-0000-0000-000000000000@localhost:5432/dice-controller
SUPERUSER_DATABASE_URL=postgresql://user:pass@localhost:5432/dice-controller
```

### Add a casino and controller

(TODO: Optimize / automate these steps)
(TODO: )

1. Register as a user on moneypot.dev
2. Create a controller at https://moneypot.dev/me/controllers and replace `<<OUR CONTROLLER UUID>>` with its ID below.
3. Click into the controller's detail page
4. At the bottom, create a new API key and replace `<<CONTROLLER API KEY>>` with the key field.

Now execute this sql to tell `dice-controller` about the moneypot.dev casino and give it our controller info.

```sql
insert into caas_secret.casinos (id, base_url, name, graphql_url, controller_id, api_key)
values (
  '00000000-0000-0000-0000-000000000001', -- This uuid doesn't matter, it just needs to be unique
  'http://moneypot.dev',
  'Moneypot.dev',
  'http://moneypot-server.moneypot.dev/graphql',
  '<<OUR CONTROLLER UUID>>',
  '<<CONTROLLER API KEY>>'
);
```

Now start the `dice-controller` server:

```sh
npm start
```

It will first run CAAS' core postgres migrations and then any of your custom migrations in `./pg-versions`.

As part of the server initialization process, it will query the moneypot.dev casino that we've inserted.
As part of that process, it will ask the casino what currencies it supports and then insert them into `caas.currencies`.

You should be able to see them here after starting `dice-controller` for the first time:

```sql
select * from caas.currencies;
```

Example:

```
key  | casino_id
------------------------------------------
BTC  | 00000000-0000-0000-0000-000000000001
TBTC | 00000000-0000-0000-0000-000000000001
PLAY | 00000000-0000-0000-0000-000000000001
```

Now that you can see casino's currencies were successfully added to your `dice-controller` database, you can create a bankroll for each one.

Note: Should probably just make a bankroll for PLAY since it's for testing.

```sql
insert into caas.bankrolls (casino_id, currency, amount) values
 ('00000000-0000-0000-0000-000000000001', 'BTC', 100000000)
,('00000000-0000-0000-0000-000000000001', 'TBTC', 100000000)
,('00000000-0000-0000-0000-000000000001', 'PLAY', 100000000)
;
```

### TODO: How to set up `dice-experience`
