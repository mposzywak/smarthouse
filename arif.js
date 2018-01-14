
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
	
	/* multicast server setup for Beacon */
	const dgram = require('dgram');
	const BBSocket = dgram.createSocket('udp4');
	
	var d = this.debug;
	var c = this.config;
	var m = this.mem;
	
	/* variable holding status of cloud connection */
	this.cloudAlive = false;
	this.cloudAliveCounter = 0;
	
	BBSocket.on('error', (err) => {
		//console.log(`BBSocket error:\n${err.stack}`);
		d.log(2, 'arif', 'Beacon socket error: ' + err.stack);
		BBSocket.close();
	});

	BBSocket.on('message', (msg, rinfo) => {
		//console.log(`BBSocket got: ${msg} from ${rinfo.address}:${rinfo.port}`);
		d.log(2, 'arif', 'Beacon received from: ' + rinfo.address + ':' + rinfo.port + ' url: ' + msg);
		var ardID = (msg + '').split('/')[2];
		var arduinoIP = m.getArduinoIP(c.cloud.id, ardID)
		if (rinfo.address == arduinoIP || '::ffff:' + rinfo.address == arduinoIP) {
			//console.log('ardIP: ' + m.getArduinoIP(c.cloud.id, ardID))
			d.log(2, 'arif', 'Beacon src IP same as registered Ard IP of: ' + ardID);
		} else {
			d.log(2, 'arif', 'Beacon src different than registered Ard IP of: ' + ardID + '. Updating.' );
			m.updateArduinoIP(c.cloud.id, ardID, rinfo.address);
		}
	});

	BBSocket.on('listening', () => {
		const address = BBSocket.address();
		BBSocket.addMembership(c.arif.beaconAddress);
		//console.log(`BBSocket listening ${address.address}:${address.port}`);
		d.log(2, 'arif', 'Beacon socket listening on ' + address.address + ':' + address.port)
	});

	BBSocket.bind(c.arif.beaconPort);
	setInterval(heartbeatArduinos, 3000);
}

var arif = new ARiF();

function heartbeatArduinos() {
	var mem = require('./mem.js');
	var config = require('./config.js');
	var accountID = require('./config.js').cloud.id;
	var raspy = mem.devices[accountID].raspys[require('./config.js').rcpclient.vpnID.split('-')[1]];
	for (ardID in raspy.arduinos) {
		if (raspy.arduinos.hasOwnProperty(ardID)){
			sendHeartbeat(ardID, raspy.arduinos[ardID].IP)
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
		//path: '/0/' + ardID + '/' + raspyID + '/' + ARIF_HEARTBEAT,
		path: '/?devID=0&ardID=' + ardID + '&raspyID=' + raspyID + '&cmd=heartbeat',
		method: 'POST',
		agent: false
	};
	
	var req = http.request(options, function (res){
		debug.log(5, 'arif', 'Received Heartbeat resp from ardID: ' + ardID + ' IP: ' + IP);
		mem.clearArduinoDeadCounter(accountID, raspyID, ardID);
	}).on('error', function(error) {
		debug.log(1, 'arif', 'Error in Heartbeat resp from ardID: ' + ardID + ' IP: ' + IP);
		mem.increaseArduinoDeadCounter(accountID, raspyID, ardID);
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
		path: '/?devID=' + device.devID + '&ardID=' + device.ardID + 
				'&raspyID=' + this.config.rcpclient.vpnID.split('-')[1] + '&cmd=' + command + '&devType=' + device.devType,
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
ARiF.prototype.validateDeviceStatusData = function(devID, ardID, raspyID, devType, dataType, value, srcIP) {
	var debug = this.debug;

	var ardIP = require('./mem.js').getArduinoIP(this.config.cloud.id, ardID);

	if (!ardIP) {
		debug.log(1, 'arif', 'Arduino with ardID: ' + ardID + ' could not be found, URL: ' + url);
		return;
	}
	
	if (!(srcIP == ardIP || '::ffff:' + srcIP == ardID || srcIP == '::ffff:' + ardIP)) {
		debug.log(1, 'arif', 'ARiF message from incorrect IP: ' + srcIP + ' URL: ' + url);
		return;
	}	
	if (!devType || !dataType || !value) {
		debug.log(1, 'arif', 'ARiF message URL incorrect: ' + url);
		return;
	}
	
	return 1;
}

ARiF.prototype.isCloudAlive = function() {
	return this.cloudAlive;
}

ARiF.prototype.setCloudAlive = function() {
	this.cloudAlive = true;
	this.cloudAliveCounter = 0;
	
	//send all device status data to cloud.
}

ARiF.prototype.setCloudDead = function() {
	this.cloudAlive = false;
}

function getParams(url) {
	var urlParams;
    var match,
        pl     = /\+/g,  // Regex for replacing addition symbol with a space
        search = /([^&=]+)=?([^&]*)/g,
        decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
        query  = window.location.search.substring(1);

    urlParams = {};
    while (match = search.exec(query))
       urlParams[decode(match[1])] = decode(match[2]);
	
	return urlParams
}

module.exports = arif;