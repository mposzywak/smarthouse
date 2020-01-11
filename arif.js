
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
	var a = this;
	
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
		
		/* we need to start new registration procedure */
		if (ardID == '0') {
			d.log(2, 'arif', 'Registration beacon received from: ' + rinfo.address);
			if (m.isPendingArduinoAllowed(rinfo.address)) {
				d.log(2, 'arif', 'Beacon received from ' + rinfo.address + ' is allowed, beginning registration');
				var newArdID = m.registerArduino(c.cloud.id, rinfo.address);
				a.sendRegisterCommand(rinfo.address, newArdID, 'EE:EA:DE:AD:BA:BE', function() {
					d.log(2, 'arif', 'Registration finished of ardID: ' + newArdID);
					m.deletePendingArduino(c.cloud.id, rinfo.address);
				});
				
			}
			else {
				m.updatePendingArduino(rinfo.address);
			}
			return;
		}
		
		var arduinoIP = m.getArduinoIP(c.cloud.id, ardID)

		if (rinfo.address == arduinoIP || '::ffff:' + rinfo.address == arduinoIP) {
			//console.log('ardIP: ' + m.getArduinoIP(c.cloud.id, ardID))
			d.log(2, 'arif', 'Beacon src IP same as registered Ard IP of: ' + ardID);
		} else if (!arduinoIP) {
			d.log(2, 'arif', 'Beacon received of a reg. Arduino, but ardID not found: ' + ardID + ', IP: ' + rinfo.address);
			if (m.isPendingArduinoAllowed(rinfo.address)) {
				d.log(2, 'arif', 'Beacon received from ' + rinfo.address + ' is allowed, beginning registration');
				var newArdID = m.registerArduino(c.cloud.id, rinfo.address);
				a.sendRegisterCommand(rinfo.address, newArdID, 'EE:EA:DE:AD:BA:BE', function () {
					d.log(2, 'arif', 'Registration finished of ardID: ' + newArdID);
					m.deletePendingArduino(c.cloud.id, rinfo.address);
				});
			}
			else {
				m.updatePendingArduino(rinfo.address);
			}
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

/* send heartbeat into each arduino */
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
	
	/* add specifics of the shade */
	if (command == 'shadePOS') {
		options.path += 'value=' + device.position;
	}
	
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

/** send register command */
ARiF.prototype.sendRegisterCommand = function(IP, ardID, MAC, callback) {
	var debug = this.debug;
	debug.log(1, 'arif', 'Sending ARiF register cmd to IP: ' + IP);
	var partMAC = 'FF:01:34:00:00:';
	var hexArdID = ardID.toString(16);
	if (ardID < 16) hexArdID = '0' + ardID.toString(16);
	var fullMAC = partMAC + hexArdID;
	var http = require('http');
	
	var options = {
		hostname: IP,
		port: this.config.arif.port,
		path: '/?devID=0&ardID=' + ardID + 
				'&raspyID=' + this.config.rcpclient.vpnID.split('-')[1] + '&cmd=register' + '&value=' + fullMAC,
		method: 'POST',
		agent: false
	};
	
	var req = http.request(options, function (res){
		debug.log(1, 'arif', 'Received Register cmd resp from IP: ' + IP);
		callback();
	}).on('error', function(error) {
		debug.log(1, 'arif', 'Error in ARiF register comms with IP: ' + IP);
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

	/* ardID reported received on ARiF isn't registered within the app */
	if (!ardIP) {
		debug.log(1, 'arif', 'Arduino with ardID: ' + ardID + ' coming from IP: ' + srcIP + ', is not registered');
		return;
	}
	
	if (!(srcIP == ardIP || '::ffff:' + srcIP == ardID || srcIP == '::ffff:' + ardIP)) {
		debug.log(1, 'arif', 'ARiF message from incorrect IP: ' + srcIP + ' URL: ' + url);
		return;
	}	
	if (!devType || !dataType || !value) {
		debug.log(1, 'arif', 'ARiF message is incorrect: devID: ' + devID + ', ardID: ' + ardID + ', raspyID: ' + raspyID + ', devType: ' + devType + ', value: ' + value + ', srcIP: ' + srcIP);
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