
/* initialize the facilities, the entry is required here for debug.log() to work with that facility */
var config = {};
var facilities = ['cloud', 'db', 'rcpserver', 'arif', 'mem', 'debug', 'backend', 'security', 'init', 'rcpclient', 'configdb', 'bfp', 'mqtt', 'os', 'ha'];
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
config.cloud.connection = true;

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
config.arif.beaconPort = 5007;


// config of the mem cache component
config.mem.debug = 5;
config.mem.minArdID = 20;
config.mem.wattMultiplier = 1.25;

// config of the backend
config.backend.debug = 5;
config.backend.port = 8087;
config.backend.html = '/frontend';
config.backend.login = true;

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
config.configdb.dbfile = '/srv/smarthouse/db/iot.db';
config.configdb.debug = 5;

// config of the MQTT client
config.mqtt.enabled = true;
config.mqtt.broker = 'mqtt://127.0.0.1';
config.mqtt.topicPrefix = 'velen-mqtt';
config.mqtt.debug = 5;

// config of the OS interfacing module
config.os.vpnCredentialsFile = '/etc/openvpn/user-pass';
config.os.vpnStatusFile = '/etc/openvpn/status';
config.os.vpnLog = '/var/log/openvpn.log';
config.os.vpnTimeout = 5;
config.os.debug = 5;

// config of the Home Assistant control module
config.ha.configFile
config.ha.debug = 5;

// config of the HA interfacing module
//config.ha.debug = 5;

module.exports = config;





