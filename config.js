
/* initialize the facilities, the entry is required here for debug.log() to work with that facility */
var config = {};
var facilities = ['cloud', 'db', 'rcp', 'arif', 'mem', 'debug', 'backend', 'security', 'init'];
facilities.forEach(function(item) {
	config[item] = {};
});


components = require('./components').setFacility(config, 'config');

config.name = 'config';

// configuration related to communication with the cloud
config.cloud.id = 'maciej_poszywak@smarthouse.com';
config.cloud.passwd = '123qwe';
config.cloud.host = 'duinocloud.org';
config.cloud.port = 24350;
config.cloud.debug = 5;

// configuration related to RethinkDB connection
config.db.host = 'localhost';
config.db.port = 29015;
config.db.debug = 5;

// configuration of ARiF protocol, 
config.arif.port = 32300;
config.arif.debug = 5;

// config of the mem cache component
config.mem.debug = 5;

// config of the backend
config.backend.debug = 5;
config.backend.port = 10080;
config.backend.html = '/frontend';

config.backend.fileSessionStoreOptions = {
		secret: require('./helpers.js').generate(40)
	};
config.backend.sessionStoreOptions = {
  connectOptions: {
    servers: [
      { host: '127.0.0.1', port: 28016 },
      { host: '127.0.0.1', port: 28015 }
    ],
    db: 'IOT',
    discovery: false,
    pool: true,
    buffer: 50,
    max: 20,
    timeout: 20,
    timeoutError: 1000
  },
  table: 'Sessions',
  sessionTimeout: 86400000,
  flushInterval: 60000,
  debug: false
};

config.backend.cookieOptions = {
	secret: 'fdsifoa4efioehfrafoeffjisaofew',
	saveUninitialized: true,
	resave: true, 
	store: config.backend.sessionStoreOptions
};

// config of the debug HTTP server
config.debug.port = 32301;
config.debug.debug = 5;

// config of the init facility
config.init.debug = 1;

config.security.privdrop = true;
config.security.uid = 99;
config.security.gid = 99;
config.security.debug = 5;

module.exports = config;
