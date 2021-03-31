

let HA = function() {
	
}

let ha = new HA();

HA.prototype.syncHA = function() {
	let debug = require('./debug.js');
	
	debug.log(1, 'ha', 'TEMP: sync HA started');
}


function deleteHAConfig() {
	
}

function writeHAConfig() {
	
}

function forceHALoadConfig() {
	
}

module.exports = ha;