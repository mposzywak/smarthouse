
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
	
	/* variables indicating that there is an ARiF operation in progress */
	this.arduinos = {};
	
	/* multicast server setup for Beacon */
	const dgram = require('dgram');
	const BBSocket = dgram.createSocket('udp4');
	
	var d = this.debug;
	var c = this.config;
	var m = this.mem;
	var a = this;
	var raspyID = this.raspyID
	
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
				var hexArdID = newArdID.toString(16);
				if (newArdID < 16) hexArdID = '0' + newArdID.toString(16);
				a.sendRegisterCommand(rinfo.address, newArdID, c.arif.partMAC + hexArdID, function() {
					d.log(2, 'arif', 'Registration finished of ardID: ' + newArdID);
					m.deletePendingArduino(c.cloud.id, rinfo.address);
					m.updateArduinoMAC(c.cloud.id, raspyID, newArdID, c.arif.partMAC + hexArdID);
					a.arduinos[newArdID] = {};
					a.arduinos[newArdID].queue = {};
					a.arduinos[newArdID].arifOngoing = false;
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
				var hexArdID = newArdID.toString(16);
				if (ardID < 16) hexArdID = '0' + newArdID.toString(16);
				a.sendRegisterCommand(rinfo.address, newArdID, c.arif.partMAC + hexArdID, function () {
					d.log(2, 'arif', 'Registration finished of ardID: ' + newArdID);
					m.deletePendingArduino(c.cloud.id, rinfo.address);
					m.updateArduinoMAC(c.cloud.id, raspyID, newArdID, c.arif.partMAC + hexArdID);
					a.arduinos[newArdID] = {};
					a.arduinos[newArdID].queue = {};
					a.arduinos[newArdID].arifOngoing = false;
				});
			}
			else {
				d.log(3, 'arif', 'Updating a pending arduino: ' + ardID + ', IP: ' + rinfo.address);
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
		agent: false,
		timeout: 3000
	};
	
	var req = http.request(options, function (res){
		debug.log(5, 'arif', 'Received heartbeat resp from ardID: ' + ardID + ' IP: ' + IP);
		mem.clearArduinoDeadCounter(accountID, raspyID, ardID);
	}).on('error', function(error) {
		debug.log(1, 'arif', 'Error in heartbeat resp from ardID: ' + ardID + ' IP: ' + IP);
		mem.increaseArduinoDeadCounter(accountID, raspyID, ardID);
	}).on('timeout', function(error) {
		debug.log(1, 'arif', 'Timeout in heartbeat resp from ardID: ' + ardID + ' IP: ' + IP);
		mem.increaseArduinoDeadCounter(accountID, raspyID, ardID);
	});
	req.setTimeout(3000);
	
	req.write('');
	req.end();
}

/**
 * Sends a command to an Arduino
 * Arguments:
 * device must have the following attributes: 
 * 		device.devID
 *		device.ardID
 *		device.IP
 *
 * additionally the following attributes are necessary for the give commands:
 *
 * shadePOS
 * 		device.position
 *
 * shadeTILT
 *		device.tilt
 *
 * lightType
 *		device.lightType
 *
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
		
		if (typeof(device.position) == 'object') {
			device.position = parseInt(device.position.toString());
		}
		
		options.path += '&value=' + device.position;
		
		//console.log('----------- Path: ' + options.path);
		
		//console.log('----------- Value 2: ' + JSON.stringify(device));
		//console.log('----------- Value 1: ' + device.position);
		
	}
	
	if (command == 'shadeTILT') {
		options.path += '&value=' + device.tilt;
	}
	
	if (command == 'lightTimer') {
		options.path += 'value=' + device.timer;
	}
	
	if (command == 'shadePTimer') {
		options.path += 'value=' + device.positionTimer;
	}
	
	if (command == 'shadeTTimer') {
		options.path += 'value=' + device.tiltTimer;
	}
	
	if (command == 'lightType') {
		options.path = '/?devID=' + device.devID + '&ardID=' + device.ardID + 
			'&raspyID=' + this.config.rcpclient.vpnID.split('-')[1] + '&cmd=' + command + '&value=' + device.lightType;
	}
	
	if (command == 'inputHold' || command == 'inputRelease' || command == 'inputOverrideOn' || command == 'inputOverrideOff') {
		options.path = '/?devID=' + device.devID + '&ardID=' + device.ardID + 
			'&raspyID=' + this.config.rcpclient.vpnID.split('-')[1] + '&cmd=' + command;
	}
	
	
	if (typeof(this.arduinos[device.ardID]) == 'undefined') {
		this.arduinos[device.ardID] = {};
		this.arduinos[device.ardID].queue = {};
		this.arduinos[device.ardID].arifOngoing = false;
	}

	let arifOngoing = this.arduinos[device.ardID].arifOngoing;
	if (this.arduinos[device.ardID].arifOngoing == false) {
		this.arduinos[device.ardID].arifOngoing = true;
		var req = http.request(options, function (res){
			debug.log(1, 'arif', 'Received ARiF command resp from: ' + device.devID + ' ardID: ' + device.ardID + ' IP: ' + device.IP);
			require('./arif.js').arduinos[device.ardID].arifOngoing = false;
			if (callback != null)
				callback(true);
			require('./arif.js').sendQueuedARiF(device.ardID);
		}).on('error', function(error) {
			debug.log(1, 'arif', 'Error in ARiF comms with: ' + device.devID + ' ardID: ' + device.ardID + ' IP: ' + device.IP);
			require('./arif.js').arduinos[device.ardID].arifOngoing = false;
			if (callback != null)
				callback(true);
			require('./arif.js').sendQueuedARiF(device.ardID);
		});
		req.write('');
		req.end();
	} else { /* arif ongoing - need to queue the transaction */
		//queue transaction
		debug.log(1, 'arif', 'ARiF cmd in progress, queueing... ' + device.devID + ' ardID: ' + device.ardID);
		this.arduinos[device.ardID].queue[device.devID + command] = {};
		//this.arduinos[device.ardID].queue[device.devID + command].devID = device.devID;
		this.arduinos[device.ardID].queue[device.devID + command].device = device;
		this.arduinos[device.ardID].queue[device.devID + command].device.position = device.position;
		this.arduinos[device.ardID].queue[device.devID + command].command = command;
		
		
		//debug.log(1, 'arif', 'ARiF queue: ' + JSON.stringify(this.arduinos[device.ardID]));
	}
}

/**
 * Function to send a queued ARiF message to an arduino. 
 * returns true if it sends a message, returns false if the queue is empty.
 */
ARiF.prototype.sendQueuedARiF = function(ardID) {
	let debug = require('./debug.js');
	var arif = this;
	
	for (var transaction in this.arduinos[ardID].queue) {
		var device = this.arduinos[ardID].queue[transaction];
		var deviceClone = JSON.parse(JSON.stringify(this.arduinos[ardID].queue[transaction].device));
		var commandClone = JSON.parse(JSON.stringify(this.arduinos[ardID].queue[transaction].command));
		console.log('--- device to be send: ' + JSON.stringify(this.arduinos[ardID].queue[transaction].device));
		delete this.arduinos[ardID].queue[transaction];
		arif.sendCommand(deviceClone, commandClone, function(){
			
		});
		return true;
	}
	debug.log(5, 'arif', 'ARiF queue empty.');
	return false;
}

/** send register command */
ARiF.prototype.sendRegisterCommand = function(IP, ardID, MAC, callback) {
	var debug = this.debug;
	debug.log(1, 'arif', 'Sending ARiF register cmd to IP: ' + IP);
	var partMAC = '4C:A1:34:00:00:';
	var hexArdID = ardID.toString(16);
	if (ardID < 16) hexArdID = '0' + ardID.toString(16);
	var fullMAC = partMAC + hexArdID;
	var http = require('http');
	
	var options = {
		hostname: IP,
		port: this.config.arif.port,
		path: '/?devID=0&ardID=' + ardID + 
				'&raspyID=' + this.config.rcpclient.vpnID.split('-')[1] + '&cmd=register' + '&value=' + MAC,
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

	
	if (!ardIP) {
		debug.log(1, 'arif', 'Arduino with ardID: ' + ardID + ' coming from IP: ' + srcIP + ', is not registered');
		return;
	}
	
	/* commented out due to issue of not reporting req.connection.remoteAddress correctly */
	if (typeof(srcIP) == 'undefined') {
		debug.log(1, 'arif', 'ARiF message from undefined IP, devID: ' + devID + ', ardID: ' + ardID);
	} else if (!(srcIP == ardIP || '::ffff:' + srcIP == ardIP || srcIP == '::ffff:' + ardIP)) {
		debug.log(1, 'arif', 'ARiF message from incorrect IP: ' + srcIP + ' expected IP: ' + ardIP);
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
