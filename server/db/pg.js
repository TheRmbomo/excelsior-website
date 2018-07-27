const {Client} = require('pg');
var dbName = 'excelsior_core';

var clientInfo = {
  user: 'postgres',
  database: dbName,
  port: 5432,
  host: 'localhost',
  password: process.env.POSTGRE
};
var pgClient = new Client(clientInfo);
var pgQuery = (query, parameters = [], info = '') => {
  if (!Array.isArray(parameters)) parameters = [];
  (info) ? info += ' - ': '';
  try {return pgClient.query(query, parameters);}
  catch (error) {throw new Error(info + error); return error;}
};

let runDB = (async () => {
  try {
    await pgClient.connect();
    await pgQuery(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    console.log('Connected to PostgreSQL Database: ' + pgClient.connectionParameters.database);
  } catch (error) {
    let message;
    switch (error.code) {
      case '28P01':
        message = 'Invalid password';
        break;
      case '3D000': // Database doesn't exist
        await pgClient.end();
        clientInfo.database = 'postgres';
        pgClient = new Client(clientInfo);
        console.log('Creating new database');
        await runDB();
        await pgQuery(`CREATE DATABASE ${dbName};`);
        await pgClient.end();
        clientInfo.database = dbName;
        pgClient = new Client(clientInfo);
        return runDB();
        break;
      case 'ECONNREFUSED':
        message = 'Cannot connect to the database';
        break;
      default:
        message = 'Unknown code ' + error.code;
    }
    console.error('Could not connect to PostgreSQL:', message);
  }
})

;(async () => {
  await runDB();
  pgQuery(`CREATE TABLE IF NOT EXISTS users (
    id uuid default uuid_generate_v4() primary key,
    shortened_id bytea,
    is_public boolean default true,
    emails varchar(255)[],
    last_unverified_email_added timestamp default now(),
    username varchar(255),
    hashed_password bytea,
    external_ids varchar(255)[],
    mongo_id varchar(24),
    first_name varchar(255),
    last_name varchar(255),
    display_name varchar(255),
    avatar_path varchar(255),
    age int2,
    language varchar(255),
    friends uuid[],
    currency real default 0.0,
    paths_following uuid[],
    auth_keys varchar(255)[],
    path_keys uuid[],
    resource_keys uuid[],
    created_at timestamp default now(),
    last_logged_in timestamp default now()
  );`)
  pgQuery(`CREATE TABLE IF NOT EXISTS paths (
    id uuid default uuid_generate_v4() primary key,
    shortened_id bytea,
    is_public boolean default true,
    name varchar(255),
    display_name varchar(255),
    image_path varchar(255),
    language varchar(255),
    tags varchar(255)[100],
    mongo_id varchar(24),
    created_by uuid,
    created_at timestamp default now(),
    contributors uuid[],
    last_modified_by uuid,
    last_modified_at timestamp default now()
  );`)
  pgQuery(`CREATE TABLE IF NOT EXISTS resources (
    id uuid default uuid_generate_v4() primary key,
    shortened_id bytea,
    is_public boolean default true,
    name varchar(255),
    display_name varchar(255),
    image_path varchar(255),
    language varchar(255),
    tags varchar(255)[100],
    mongo_id varchar(24),
    created_by uuid,
    created_at timestamp default now(),
    last_modified_by uuid,
    last_modified_at timestamp default now()
  );`)
  pgQuery(`CREATE TABLE IF NOT EXISTS files (
    id uuid default uuid_generate_v4() primary key,
    name varchar(255),
    owner uuid,
    path varchar(255),
    size int default 0,
    type varchar(15),
    created_at timestamp default now(),
    times_accessed int default 0,
    last_accessed_at timestamp default now()
  );`)
  pgQuery(`CREATE TABLE IF NOT EXISTS questions (
    id serial primary key,
    first_name varchar(255),
    last_name varchar(255),
    question varchar(255),
    asked_at timestamp default now(),
    answer varchar(255),
    answered_by varchar(255),
    answered_at timestamp
  )`)
})()

module.exports = {pgQuery};
