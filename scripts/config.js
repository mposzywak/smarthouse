
/* initialize the facilities, the entry is required here for debug.log() to work with that facility */
var config = {};
var facilities = ['arif', 'debug', 'security', 'devices'];
facilities.forEach(function(item) {
	config[item] = {};
});

config.name = 'config';


// configuration of ARiF protocol, 
config.arif.port = 32302;
config.arif.debug = 5;

// config of the debug HTTP server
config.debug.port = 32303;
config.debug.debug = 5;

config.security.privdrop = true;
config.security.uid = 99;
config.security.gid = 99;
config.security.debug = 5;

config.devices.debug = 5;

module.exports = config;


