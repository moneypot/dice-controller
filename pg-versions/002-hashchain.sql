CREATE TABLE app_public.hashchain (
  id               uuid PRIMARY KEY DEFAULT caas_hidden.uuid_generate_v7(),
  user_id          uuid NOT NULL REFERENCES caas.user(id),
  experience_id    uuid NOT NULL REFERENCES caas.experience(id),
  casino_id        uuid NOT NULL REFERENCES caas.casino(id),
  client_seed      text NOT NULL,
  active           boolean NOT NULL
);
CREATE INDEX ON app_public.hashchain(user_id);
CREATE INDEX ON app_public.hashchain(experience_id);
CREATE INDEX ON app_public.hashchain(casino_id);

-- Ensure only one active hashchain per user per experience per casino
CREATE UNIQUE INDEX idx_active_hashchain
ON app_public.hashchain (user_id, experience_id, casino_id)
WHERE active = true;




CREATE TYPE app_public.hash_type AS ENUM (
  'TERMINAL_HASH', -- we automatically make this to figure out the terminating hash, so the persons first bet is provably fair
  'PREIMAGE_HASH', -- we can use this hash to make sure our last bet was provably fair

  -- Log the bet type
  'DICE_BET'
);

-- this is the base table for all bets events
CREATE TABLE app_public.hash (
  id            uuid  PRIMARY KEY DEFAULT caas_hidden.uuid_generate_v7(),
  type          app_public.hash_type not null,
  hashchain_id  uuid  NOT NULL REFERENCES app_public.hashchain(id),
  user_id uuid not null references caas.user(id), 
  casino_id uuid not null references caas.casino(id),
  experience_id uuid not null references caas.experience(id),
  --
  iteration     int   NOT NULL, -- which Nth value from the hash chain it is
  hash          bytea NOT NULL -- the actual hash we got from hashchainserver
);
CREATE INDEX ON app_public.hash(hashchain_id);
CREATE INDEX ON app_public.hash(user_id);
CREATE INDEX ON app_public.hash(casino_id);
CREATE INDEX ON app_public.hash(experience_id);

-- Ensure iterations are unique per hashchain to avoid dupe mistakes
create unique index on app_public.hash(hashchain_id, iteration);

-- Ensure a hashchain only has of each end-type hash
CREATE UNIQUE INDEX idx_hashchain_terminal_hash ON app_public.hash (hashchain_id) WHERE type = 'TERMINAL_HASH';
CREATE UNIQUE INDEX idx_hashchain_preimage_hash ON app_public.hash (hashchain_id) WHERE type = 'PREIMAGE_HASH';

create function app_public.user_active_hashchain(u caas.user) returns app_public.hashchain as $$
  select * from app_public.hashchain where user_id = u.id and active = true;
$$ language sql stable;

-- GRANTS

grant select on table app_public.hashchain to app_postgraphile;
grant select on table app_public.hash to app_postgraphile;

-- RLS

alter table app_public.hashchain enable row level security;
alter table app_public.hash enable row level security;

create policy select_hashchains on app_public.hashchain for select using (
  user_id = current_setting('session.user_id', true)::uuid
  and casino_id = current_setting('session.casino_id', true)::uuid
  and experience_id = current_setting('session.experience_id', true)::uuid
);

create policy select_hashchain_hash on app_public.hash for select using (
  user_id = current_setting('session.user_id', true)::uuid
  and casino_id = current_setting('session.casino_id', true)::uuid
  and experience_id = current_setting('session.experience_id', true)::uuid
);
