
/* initialize the facilities, the entry is required here for debug.log() to work with that facility */
var config = {};
var facilities = ['cloud', 'db', 'rcpserver', 'arif', 'mem', 'debug', 'backend', 'security', 'init', 'rcpclient', 'configdb'];
facilities.forEach(function(item) {
	config[item] = {};
});


components = require('./components').setFacility(config, 'config');

config.name = 'config';

// configuration related to communication with the cloud
config.cloud.id = 'admin';
config.cloud.passwd = 'admin';
//defines if the app is running in cloud (true) or raspy mode (false)
config.cloud.enabled = false;
//(only valid in raspy mode) defines if we should initiate a cloud RCP connection
config.cloud.connection = false;

// RCP client protocol settings (TODO: later credentials have to be taken from /etc/openvpn/username)
config.rcpclient.vpnID = '00001002-001';
config.rcpclient.host = 'localhost';
config.rcpclient.port = 32400;
config.rcpclient.debug = 5;
config.rcpclient.vpnkey = '33e9bc2d515c7923';

// configuration related to RethinkDB connection
/*config.db.host = 'localhost';
config.db.port = 29015;
config.db.debug = 5;
config.db.file = '/home/maciej/configdb/test.db';
*/
// configuration of ARiF protocol, 
config.arif.port = 32302;
config.arif.debug = 5;
config.arif.beaconAddress = '224.1.1.1';
config.arif.beaconPort = 5007

// config of the mem cache component
config.mem.debug = 5;

// config of the backend
config.backend.debug = 5;
config.backend.port = 10090;
config.backend.html = '/frontend';
/*
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
};*/

config.backend.cookieOptions = {
	secret: 'fdsifoa4efioehfrafoeffjisaofew',
	saveUninitialized: true,
	resave: true, 
	store: config.backend.sessionStoreOptions
};

// config of the debug HTTP server
config.debug.port = 32303;
config.debug.debug = 5;

// config of the init facility
config.init.debug = 1;

config.security.privdrop = true;
config.security.uid = 99;
config.security.gid = 99;
config.security.debug = 5;

// config of the RCP (Raspy-Cloud Protocol) facility 
config.rcpserver.port = 32401;
config.rcpserver.debug = 5;

// config of the SQLite DB for config store and device status
config.configdb.dbfile = '/home/maciej/configdb/test.db';
config.configdb.debug = 5;
module.exports = config;


