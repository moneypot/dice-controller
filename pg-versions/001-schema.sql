
drop schema if exists app_public cascade;
drop schema if exists app_secret cascade;
drop schema if exists app_hidden cascade;

create schema app_public;
create schema app_secret;
create schema app_hidden;

grant usage on schema app_public to app_postgraphile;
