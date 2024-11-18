CREATE TABLE app_public.dice_bet (
    id          uuid primary key  REFERENCES app_public.hash(id),
    wager       float8 not null,
    net         float8 not null, -- negative if lost, wager*(target-1) if won
    -- multipliers
    target      float8 not null,
    actual      float8 not null,
    currency_key text not null,

    -- lets us easily look up the lastest bets for users, casinos, experiences
    user_id uuid not null references caas.user(id),
    casino_id uuid not null references caas.casino(id), 
    experience_id uuid not null references caas.experience(id), 

    foreign key (currency_key, casino_id) references caas.currency(key, casino_id)
);

-- query { currentUser { latestDiceBets { id wager net currency } } }
--
-- TODO: Could be a richer `diceBets` query that returns edges / nodes with pagination. But we don't need that yet.
create function app_public.user_latest_dice_bets(u caas.user) returns app_public.dice_bet[] as $$
  select array(
    select db
    from app_public.dice_bet db
    where db.user_id = u.id
      and db.casino_id = u.casino_id
      and db.experience_id = current_setting('session.experience_id', true)::uuid
    order by db.id desc
    limit 10
  );
$$ language sql stable;

-- GRANTS


grant select on table app_public.dice_bet to app_postgraphile;

-- RLS

alter table app_public.dice_bet enable row level security;

-- Only the owner can see their own dice bets
create policy select_dice_bets on app_public.dice_bet for select using (
  user_id = current_setting('session.user_id', true)::uuid
  and casino_id = current_setting('session.casino_id', true)::uuid
  and experience_id = current_setting('session.experience_id', true)::uuid
);
