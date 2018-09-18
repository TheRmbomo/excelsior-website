var config = require('./config.json');
if (config.NODE_ENV) process.env.NODE_ENV = config.NODE_ENV
var env = process.env.NODE_ENV || 'development';

var envConfig = config[env];
Object.keys(envConfig).forEach(key => {
  process.env[key] = envConfig[key];
});
