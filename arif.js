
const ARIF_LIGHT_ON  = '1';
const ARIF_LIGHT_OFF = '2';
const ARIF_HEARTBEAT = 'F0';

const MSG_ARD_SUCCESS = '0';
const MSG_ARD_UNREACHABLE = '1';

var ARiF = function() {
	this.config = require('./config.js');
	this.debug = require('./debug.js');
	this.mem = require('./mem.js');
	this.raspyID = this.config.rcpclient.vpnID.split('-')[1];
	
	setInterval(heartbeatArduinos, 3000);
}

var arif = new ARiF();

function heartbeatArduinos() {
	var mem = require('./mem.js');
	var config = require('./config.js');
	var accountID = require('./config.js').cloud.id;
	var raspy = mem.devices[accountID][require('./config.js').rcpclient.vpnID.split('-')[1]];
	for (ardID in raspy) {
		if (raspy.hasOwnProperty(ardID)){
			sendHeartbeat(ardID, raspy[ardID].IP)
		}
	}
	
}

function sendHeartbeat(ardID, IP) {
	var mem = require('./mem.js');
	var config = require('./config.js');
	var accountID = config.cloud.id;
	var raspyID = config.rcpclient.vpnID.split('-')[1];
	var debug = require('./debug.js');
	debug.log(5, 'arif', 'Sending ARiF heartbeat for the following ardID:' + ardID + ' IP: ' + IP);

	var http = require('http');
	var options = {
		hostname: IP,
		port: config.arif.port,
		path: '/0/' + ardID + '/' + raspyID + '/' + ARIF_HEARTBEAT,
		method: 'POST',
		agent: false
	};
	
	var req = http.request(options, function (res){
		debug.log(5, 'arif', 'Received Heartbeat resp from ardID: ' + ardID + ' IP: ' + IP);
		mem.clearDeadCounter(accountID, raspyID, ardID);
	}).on('error', function(error) {
		debug.log(1, 'arif', 'Error in Heartbeat resp from ardID: ' + ardID + ' IP: ' + IP);
		mem.increaseDeadCounter(accountID, raspyID, ardID);
	});
	
	req.write('');
	req.end();
}

/**
 * Sends a command to an Arduino
 */
ARiF.prototype.sendCommand = function(device, command, callback) {
	var debug = this.debug;
	debug.log(1, 'arif', 'Sending ARiF command to device devID: ' + device.devID + ' ardID: ' + 
			device.ardID + ' IP: ' + device.IP + ' command: ' + command);
				
	var http = require('http');
	
	var options = {
		hostname: device.IP,
		port: this.config.arif.port,
		path: '/' + device.devID + '/' + device.ardID + '/' + this.config.rcpclient.vpnID.split('-')[1] + '/' + command,
		method: 'POST',
		agent: false
	};
	
	var req = http.request(options, function (res){
		debug.log(1, 'arif', 'Received ARiF command resp from: ' + device.devID + ' ardID: ' + 
			device.ardID + ' IP: ' + device.IP);
	}).on('error', function(error) {
		debug.log(1, 'arif', 'Error in ARiF comms with: ' + device.devID + ' ardID: ' + 
			device.ardID + ' IP: ' + device.IP);
	});
	
	req.write('');
	req.end();
}

/**
 * This function checks if the dataTransfer command from an Arduino is correct and comes from non-spoofed IP
 */
ARiF.prototype.validateDataTransferURL = function(url, srcIP) {
	var debug = this.debug;
	var devID = url.split('/')[1];
	var ardID = url.split('/')[2];
	var command = url.split('/')[3];
	var devType = url.split('/')[4];
	var dataType = url.split('/')[5];
	var value = url.split('/')[6];
	var ardIP = require('./mem.js').getArduinoIP(this.config.cloud.id, ardID);

	if (!ardIP) {
		debug.log(1, 'arif', 'Arduino with ardID: ' + ardID + ' could not be found, URL: ' + url);
		return;
	}
	
	if (srcIP != ardIP) {
		debug.log(1, 'arif', 'ARiF message from incorrect IP: ' + srcIP + ' URL: ' + url);
		return;
	}	
	if (!devType || !dataType || !value) {
		debug.log(1, 'arif', 'ARiF message URL incorrect: ' + url);
		return;
	}
	
	return 1;
}



module.exports = arif;