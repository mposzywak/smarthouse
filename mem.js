/*
 * This is mem cache module which is used to hold current status of all the devices 
 * in the memory, each device (ardID & devID) has a an entry in the dictionary:
 *
 * this.devices[accountID][ardID][devID]
 *
 */

/* consts for message codes */
const MSG_ARDUINO_DEAD = 0;
const MSG_ARDUINO_ALIVE = 1;
const MSG_ARDUINO_PENDING = 2;
 
var Mem = function() {
	this.devices = {};
	var devices = this.devices;
	var mem = this;
	this.components = require('./components').setFacility(this, 'mem');
	this.config = require('./config.js');
	//this.raspyID = require('./config.js').cloud.raspy;
    // raspyID parameter is only used by ARiF related function, so this setting on the cloud doesn't matter.
	this.db = require('./configdb.js');

}

var memory = new Mem();

Mem.prototype.initialize = function(callback) {
	var mem = this;
	var devices = this.devices;

	if (!this.config.cloud.enabled) {
		this.raspyID = require('./config.js').rcpclient.vpnID.split('-')[1];
		this.accountID = this.config.cloud.id;
		var accountID = this.accountID;
		var raspyID = this.raspyID;
		this.devices[this.accountID] = {};
		this.devices[this.accountID].raspys = {};
		this.devices[this.accountID].raspys[this.raspyID] = {};
		
		this.db.getAllAccountDevices(this.accountID, function(error, raspys) {
			if (error) {
				require('./debug.js').log(1, 'configdb', 'Failed to access configDB: ' + error.message);
			} else {
				devices[accountID] = raspys;
				devices[accountID].raspys[raspyID].pending = {};
				require('./debug.js').log(1, 'configdb', 'ConfigDB contents loaded succesfully [Raspy mode]');
				callback(null);
			}
		});
		this.rcpclient = require('./rcpclient.js');
	} else {
		this.db.getEverything(function(error, accounts) {
			if (error != null) {
				require('./debug.js').log(1, 'configdb', 'Failed to access configDB: ' + error.message);
			} else {
				
				mem['devices'] = accounts;
				require('./debug.js').log(1, 'configdb', 'ConfigDB contents loaded succesfully [Cloud mode]');
				callback(null)
			}
		});
	}
}

/* function registers new Arduino to the system, should be called every time registration command is received on the ARIF 
   it returns arduino ID
*/
Mem.prototype.registerArduino = function(accountID, IP) {
	// check if the accountID, device and arduino exists
	if (typeof(this.devices[accountID].raspys[this.raspyID].arduinos) == 'undefined') {
		var ardID = '1'; /* if entered this condition it means this is the first arduino, give it ID "1" */

		this.devices[accountID].raspys[this.raspyID].arduinos = {};
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID] = {};
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices = {};
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].IP = IP; 
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].raspyID = this.raspyID;
		this.db.insertArduino(accountID, this.raspyID, IP, ardID);
		this.components.getFacility('debug').log(4, 'mem', 'accountID id: ' + accountID + 
				', new Arduino registered: ' + ardID + ' from: ' + IP);
		return ardID;
	} else { /* if at least one Arduino already registered (check by IP) */
	
		ardIDRegistered = this.isArduinoIPRegistered(accountID, IP);
		if (ardIDRegistered) {
			this.components.getFacility('debug').log(4, 'mem', 'accountID id: ' + accountID + 
				', Arduino from: ' + IP + ' registered already as: ' + ardIDRegistered);
			return ardIDRegistered;
		} else { /* new Arduino device (new IP) */
			ardID = '2';
			while (true) {
				if (typeof(this.devices[accountID].raspys[this.raspyID].arduinos[ardID]) == 'undefined') {
					this.devices[accountID].raspys[this.raspyID].arduinos[ardID] = {};
					this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices = {}
					this.devices[accountID].raspys[this.raspyID].arduinos[ardID].IP = IP;
					this.devices[accountID].raspys[this.raspyID].arduinos[ardID].raspyID = this.raspyID;
					this.db.insertArduino(accountID, this.raspyID, IP, ardID);
					this.components.getFacility('debug').log(4, 'mem', 'accountID id: ' + accountID + 
							', new Arduino registered: ' + ardID + ' from: ' + IP);
					return ardID;
				}
				ardIDDec = parseInt(ardID, 10);
				ardIDDec += 1
				ardID = ardIDDec.toString(10);
				/* we can register only 250 arduinos */
				if (ardID == '250') return 0; /* fa is 250 */
			}
		}
	}
}

/* check if Arduino has been registered already */
Mem.prototype.isArdIDRegistered = function(accountID, ardID) {
	if (typeof(this.devices[accountID].raspys[this.raspyID].arduinos[ardID]) == 'undefined') 
		return true;
	else
		return false;
}

/* returns Arduinos IP address */
Mem.prototype.getArduinoIP = function(accountID, ardID) {
	if (!this.devices[accountID] || !this.devices[accountID].raspys)
		return null;
	//var arduino = this.devices[accountID].raspys[this.raspyID].arduinos[ardID];
	if (!this.devices[accountID].raspys[this.raspyID].arduinos[ardID])
		return null;
	else
		return this.devices[accountID].raspys[this.raspyID].arduinos[ardID].IP;
}

Mem.prototype.updateArduinoIP = function(accountID, ardID, IP) {
	var arduino = this.devices[accountID].raspys[this.raspyID].arduinos[ardID];
	var devices = this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices;
	var updateArduino = {};
	var db = require('./configdb.js');
	
	arduino.IP = IP;
	updateArduino.ardID = ardID;
	updateArduino.IP = IP;
	updateArduino.raspyID = arduino.raspyID;
	db.updateArduino(accountID, updateArduino);
	
	for (var devID in devices) {
		if (devices.hasOwnProperty(devID)) {
			devices[devID].IP = IP;
			db.updateDevice(accountID, devices[devID]);
		}
	}
}

/* checks if the IP address where the registration came from was already registered and contains ardID,
   in such case, function returns ardID */
Mem.prototype.isArduinoIPRegistered = function(accountID, IP) {
	for (var ardID in this.devices[accountID].raspys[this.raspyID].arduinos) {
		if (this.devices[accountID].raspys[this.raspyID].arduinos.hasOwnProperty(ardID)) {
			if (this.devices[accountID].raspys[this.raspyID].arduinos[ardID].IP == IP) {
				return ardID;
			}
		}
	}
	return false;
}

/**
 * Delete Arduino and all it's devices from the mem and the DB
 */
Mem.prototype.deleteArduino = function(accountID, raspyID, ardID) {
	var arduinos = this.devices[accountID].raspys[raspyID].arduinos;
	var arduino = {}
	arduino.ardID = ardID;
	arduino.raspyID = raspyID;
	delete arduinos[ardID];
	this.db.deleteArduino(accountID, arduino);
}
/* the method puts the latest status into the mem cache 
	As an argument it takes BFPDeviceStatus object and accountID.
*/
Mem.prototype.setDeviceStatus = function(accountID, BFPDeviceStatus) {
	var isDeviceNew = false;
	var db = this.db;
	var device = this.devices[accountID].raspys[this.raspyID].arduinos[BFPDeviceStatus.body.ardID].devices[BFPDeviceStatus.body.devID];
	var userIndicaitonHeader = BFPDeviceStatus.header.user;

	if (typeof(device) == 'undefined') {
		var newDevice = {};
		newDevice.desc = '';
		newDevice.activated = false;
		newDevice.discovered = false;
		newDevice.IP = BFPDeviceStatus.body.IP;
		newDevice.devType = BFPDeviceStatus.body.devType;
		newDevice.dataType = BFPDeviceStatus.body.dataType;
		newDevice.raspyID = this.raspyID;
		newDevice.ardID = BFPDeviceStatus.body.ardID;
		newDevice.devID = BFPDeviceStatus.body.devID;
		newDevice.alive = true;
		isDeviceNew = true;
		this.components.getFacility('debug').log(4, 'mem', 'existing accountID id: ' + accountID + ', existing Arduino registered: ' + 
				BFPDeviceStatus.body.ardID + ' and new device: ' + BFPDeviceStatus.body.devID);
		this.devices[accountID].raspys[this.raspyID].arduinos[BFPDeviceStatus.body.ardID].devices[BFPDeviceStatus.body.devID] = newDevice;
		device = this.devices[accountID].raspys[this.raspyID].arduinos[BFPDeviceStatus.body.ardID].devices[BFPDeviceStatus.body.devID];
	}

	if (device.activated == true) { 
		device.discovered = true;
	} else {
		device.discovered = false;
	}
	
	// save the old value for later comparison
	var oldValue = device.value
	
	device.value = BFPDeviceStatus.body.value;
	
	device.date = BFPDeviceStatus.body.date.getTime();

	// when we detect that the new value is different then the old one.
	if (oldValue != device.value) {
		
		if (isDeviceNew) {
			this.db.insertDevice(accountID, device);
		} else {
			this.db.updateDevice(accountID, device);
		}
	}
	/* always send the newest device */
	var newBFPDeviceStatus = require('./bfp.js').BFPCreateDeviceStatusFromMem(device);
	newBFPDeviceStatus.header.user = userIndicaitonHeader;
	
	onValueChange(accountID, newBFPDeviceStatus);
	this.rcpclient.sendDeviceStatus(device);
	this.components.getFacility('debug').log(5, 'mem', 
		'For accountID id: ' + accountID + ', Arduino: "' + device.ardID + '", Device: "' + device.devID +
		'" Record updated by ARIF -> IP: ' + device.IP + 
		' devType: ' + device.devType +
		' dataType: ' + device.dataType +
		' valule: ' + device.value +
		' date: ' + JSON.stringify(device.date));
}

/* set new device. This procedure is initiated on CMD 0x32 devMapping */
Mem.prototype.setDevice = function(accountID, devID, ardID, devType, date, IP, controlledDevs) {
	/* no need to check for arduinoID or accountID in devices structure */
	if (typeof(this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID]) == 'undefined') {
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID] = {};
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].desc = '';
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].activated = false;
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].discovered = false;
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].IP = IP;
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].devType = devType;
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].controlledDevs = '';
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].raspyID = this.raspyID;
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].ardID = ardID;
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].devID = devID;
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].date = date.getTime();
		
		for (var i in controlledDevs) {
			this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].controlledDevs += controlledDevs[i] + ' ';
		}
		
		this.db.insertDevice(accountID, this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID])
		this.components.getFacility('debug').log(5, 'mem', 
			'[' + accountID + '] ardID: "' + ardID + '", devID: "' + devID +
			' registered by ARIF -> IP: ' + this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].IP + 
			' devType: ' + this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].devType +
			' date: ' + JSON.stringify(this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].date));
		
	} else {
		/* exit function as it looks like the device is already registered/mapped in the DB */
		this.components.getFacility('debug').log(4, 'mem', 'accountID id: ' + accountID + ', Arduino: ' + 
				ardID + ' existing devID mapping came: ' + devID);
		return;
	}
}

Mem.prototype.updateRaspyIP = function(accountID, raspyID, IP) {
	if (typeof(this.devices[accountID]) == 'undefined') {
		this.components.getFacility('debug').log(1, 'mem', 'accountID id: ' + accountID + ' not present in DB! This should not happen!');
		return;
	}
	if (typeof(this.devices[accountID].raspys[raspyID]) == 'undefined') {
		this.devices[accountID].raspys[raspyID] = {}
		this.devices[accountID].raspys[raspyID].arduinos = {}
		this.devices[accountID].raspys[raspyID].IP = IP;
	} else {
		this.devices[accountID].raspys[raspyID].IP = IP;
	}
}

/* set device status. Executed when the data is coming from RCP */
Mem.prototype.setRCPDeviceStatus = function(vpnid, raspyip, device) {
	accountID = vpnid.split('-')[0];
	raspyID = vpnid.split('-')[1];
	var value;

	// TODO: put here the limitations on the number of devices, raspys, arduinos, etc...
	if (typeof(this.devices[accountID]) == 'undefined') {
		this.devices[accountID] = {};
		this.devices[accountID].raspys = {};
	}
	if (typeof(this.devices[accountID].raspys[raspyID]) == 'undefined') {
		this.devices[accountID].raspys[raspyID] = {};
		this.devices[accountID].raspys[raspyID].IP = raspyip;
		this.devices[accountID].raspys[raspyID].arduinos = {};
	}
	if (typeof(this.devices[accountID].raspys[raspyID].arduinos[device.ardID]) == 'undefined') {
		this.devices[accountID].raspys[raspyID].arduinos[device.ardID] = {};
		this.devices[accountID].raspys[raspyID].arduinos[device.ardID].devices = {};
		this.devices[accountID].raspys[raspyID].arduinos[device.ardID].IP = device.IP;
	} else {
		if  (typeof(this.devices[accountID].raspys[raspyID].arduinos[device.ardID].devices[device.devID]) == 'undefined') {
			// device doesn't exist
			this.devices[accountID].raspys[raspyID].arduinos[device.ardID].devices[device.devID] = device;
			var BFPDeviceStatus = require('./bfp.js').BFPCreateDeviceStatusFromMem(device);
			onValueChange(accountID, BFPDeviceStatus);
			this.db.insertDevice(accountID, this.devices[accountID].raspys[raspyID].arduinos[device.ardID].devices[device.devID])
		} else {
			// device exists, just check the value
			if (this.devices[accountID].raspys[raspyID].arduinos[device.ardID].devices[device.devID].value != device.value){
				this.devices[accountID].raspys[raspyID].arduinos[device.ardID].devices[device.devID].value = device.value;
				this.devices[accountID].raspys[raspyID].arduinos[device.ardID].devices[device.devID].date = device.date;
				var BFPDeviceStatus = require('./bfp.js').BFPCreateDeviceStatusFromMem(device);
				onValueChange(accountID, BFPDeviceStatus);
				this.db.updateDevice(accountID, this.devices[accountID].raspys[raspyID].arduinos[device.ardID].devices[device.devID])
			}
		}
	}
	
	var currentDevice = this.devices[accountID].raspys[raspyID].arduinos[device.ardID].devices[device.devID];
/*	this.components.getFacility('debug').log(5, 'mem', 
			'For accountID: ' + accountID + 'raspyID: ' + raspyID + ', Arduino: "' + device.ardID + '", Device: "' + device.devID +
			'" Record updated by RCP -> IP: ' + currentDevice.IP + 
			' devType: ' + currentDevice.devType +
			' dataType: ' + currentDevice.dataType +
			' value: ' + currentDevice.value +
			' date: ' + currentDevice.date); */
}


/* function executed if the new value of the mem cache is different than the old one.
   The output interfaces, like the backend need to be updated */
function onValueChange(accountID, BFPDeviceStatus) {
	io = this.components.getFacility('backend').io;
	io.of('/iot').to(accountID).emit('device_status', BFPDeviceStatus);
}


function onArduinoChange(accountID, raspyID, ardID) {
	var io = this.components.getFacility('backend').io;
	var arduinoToSend = {};
	var arduino = require('./mem.js').devices[accountID].raspys[raspyID].arduinos[ardID];

	arduinoToSend.ardID = ardID;
	if (typeof(arduino.name) != 'undefined')
		arduinoToSend.name = arduino.name;
	arduinoToSend.IP = arduino.IP;
	arduinoToSend.alive = arduino.alive;
	arduinoToSend.raspyID = raspyID;
	require('./debug.js').log(5, 'mem', '[' + accountID + '] Emitting Arduino data of raspyID: ' + arduino.raspyID +
									' ardID: ' + arduino.ardID);
	io.of('/iot').to(accountID).emit('arduino', arduinoToSend);
}

function sendArduinoDeadMessage(accountID, raspyID, ardID) {
	var message = {};
	var arduino = 
	message.code = MSG_ARDUINO_DEAD;
	message.raspyID = raspyID;
	message.ardID = ardID;
	
	io = this.components.getFacility('backend').io;
	io.of('/iot').to(accountID).emit('message', message);
	onArduinoChange(accountID, raspyID, ardID);
}

function sendArduinoAliveMessage(accountID, raspyID, ardID) {
	var message = {};
	message.code = MSG_ARDUINO_ALIVE;
	message.raspyID = raspyID;
	message.ardID = ardID;
	
	io = this.components.getFacility('backend').io;
	io.of('/iot').to(accountID).emit('message', message);
	onArduinoChange(accountID, raspyID, ardID);
}

/**
 *	Send to the GUI that a pending Arduino is awaiting confirmation or denial
 */
function sendPendingArduinoUpdate(raspyID, ardIP) {
	var message = {};
	var m = require('./mem.js');
	var pending = m.devices[m.accountID].raspys[m.raspyID].pending;
	message.code = MSG_ARDUINO_ALIVE;
	message.raspyID = raspyID;
	message.allowed = pending[ardIP].allowed;
	message.lastDate = pending[ardIP].lastDate;
	message.firstDate = pending[ardIP].firstDate;
	message.ardIP = ardIP;
	
	io = this.components.getFacility('backend').io;
	io.of('/iot').to(m.accountID).emit('pending_arduino', message);
}

/**
 *	Set a pending Arduino state to allow
 */
Mem.prototype.allowPendingArduino = function(raspyID, ardIP) {
	var pending = this.devices[this.accountID].raspys[this.raspyID].pending;
	if (typeof(pending[ardIP]) != 'undefined') {
		pending[ardIP].allowed = true;
	}
}

/**
 * 	Delete a pending arduino from the list
 */
Mem.prototype.deletePendingArduino = function(raspyID, ardIP) {
	var pending = this.devices[this.accountID].raspys[this.raspyID].pending;
	if (typeof(pending[ardIP]) != 'undefined') {
		delete pending[ardIP]
	} 
}

/* return mem cache object of a single device based on ardID, devID */
Mem.prototype.getDeviceStatus = function(accountID, raspyID, ardID, devID) {
	if (typeof(this.devices[accountID].raspys[raspyID].arduinos[ardID]) == 'undefined') {
		return;
	} else if (this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID] == 'undefined') {
		return;
	}
	
	return this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID];
}

/* return the whole devices structure */
Mem.prototype.getDeviceStatusAll = function() {
	return this.devices;
}

Mem.prototype.getClientDevices = function (accountID) {
	return this.devices[accountID];
}

/* increment Arduino dead counter (only raspy) */
Mem.prototype.increaseArduinoDeadCounter = function(accountID, raspyID, ardID) {
	var arduino = this.devices[accountID].raspys[raspyID].arduinos[ardID];
	
	// in case arduino has been delete meanwhile
	if (!arduino) return;
	
	
	if (!arduino.counter)
		arduino.counter = 0
	
	if (arduino.counter < 3)
		arduino.counter += 1;
	
	if (arduino.counter == 3 && arduino.alive != false) {
		this.setArduinoDead(accountID, raspyID, ardID);
		require('./rcpclient.js').sendArduinoDead(ardID);
	}
}

/* increment Raspy dead counter (only cloud) */
Mem.prototype.increaseRaspyDeadCounter = function(accountID, raspyID) {
	var raspy = this.devices[accountID].raspys[raspyID];
	
	// in case raspy has been deleted meanwhile
	if (!raspy) return;
	
	if (!raspy.counter)
		raspy.counter = 0
	
	if (raspy.counter < 3)
		raspy.counter += 1;
	
	if (raspy.counter == 3)
		this.setRaspyDead(accountID, raspyID);
		
}

/* clear the Arduino dead counter (only raspy) */
Mem.prototype.clearArduinoDeadCounter = function(accountID, raspyID, ardID) {
	var arduino = this.devices[accountID].raspys[raspyID].arduinos[ardID];
	
	// in case arduino has been delete meanwhile
	if (!arduino) return;
	
	if (arduino.alive != true) { //true 
		require('./rcpclient.js').sendArduinoAlive(ardID);
		this.setArduinoAlive(accountID, raspyID, ardID);
	}
	arduino.counter = 0
	
}

/* clear the Raspy dead counter (only cloud) */
Mem.prototype.clearRaspyDeadCounter = function(accountID, raspyID) {
	this.devices[accountID].raspys[raspyID].counter = 0
	this.setRaspyAlive(accountID, raspyID);
}

/* sets a given Arduino status dead and all its devices (both raspy and cloud) */
Mem.prototype.setArduinoDead = function(accountID, raspyID, ardID) {
	var arduino = this.devices[accountID].raspys[raspyID].arduinos[ardID];

	arduino.alive = false;

	for (var devID in arduino.devices) {
		if (arduino.devices.hasOwnProperty(devID)){
			var device = this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID];
			
			if (device.alive == true || typeof(device.alive) == 'undefined') {
				this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID].alive = false;
				var BFPDeviceStatus = require('./bfp.js').BFPCreateDeviceStatusFromMem(device);
				onValueChange(accountID, BFPDeviceStatus);
				
				this.components.getFacility('debug').log(5, 'mem', '[' + accountID + '] ArdID and its devIDs declared dead: ' + 
						ardID + ' on raspyID: ' + raspyID + ' devID: ' + devID);
			}
		}
	}
	sendArduinoDeadMessage(accountID, raspyID, ardID);
}

/* sets a given Arduino status alive and all its devices (both raspy and cloud) */
Mem.prototype.setArduinoAlive = function(accountID, raspyID, ardID) {
	this.devices[accountID].raspys[raspyID].arduinos[ardID].alive = true;
	for (var devID in this.devices[accountID].raspys[raspyID].arduinos[ardID].devices) {
		if (this.devices[accountID].raspys[raspyID].arduinos[ardID].devices.hasOwnProperty(devID)){
			var device = this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID];
			
			if (device.alive == false || typeof(device.alive) == 'undefined') {
				device.alive = true;
				this.components.getFacility('debug').log(5, 'mem', '[' + accountID + '] ArdID and its devIDs declared alive: ' + 
						ardID + ' on raspyID: ' + raspyID + ' devID: ' + devID);
				var BFPDeviceStatus = require('./bfp.js').BFPCreateDeviceStatusFromMem(device);
				onValueChange(accountID, BFPDeviceStatus);
			}
		}
	}
	sendArduinoAliveMessage(accountID, raspyID, ardID);
}

/* sets give Raspy status to alive (only cloud) */
Mem.prototype.setRaspyAlive = function(accountID, raspyID) {
	var raspy = this.devices[accountID].raspys[raspyID];
	if (raspy.alive == false || typeof(raspy.alive) == 'undefined') {
		raspy.alive = true;
		require('./debug.js').log(5, 'mem', '[' + accountID + '] raspyID and its devices alive: ' + raspyID);
	}
	// we don't want this as Raspy can be alive but Arduinos still dead.
	/*for (var ardID in raspy.arduinos) {
		if (raspy.arduinos.hasOwnProperty(ardID))
			this.setArduinoAlive(accountID, raspyID, ardID);
	}*/
}

/* sets give Raspy status to dead (only cloud) */
Mem.prototype.setRaspyDead = function(accountID, raspyID, ardID) {
	var raspy = this.devices[accountID].raspys[raspyID];
	if (raspy.alive == true || typeof(raspy.alive) == 'undefined') {
		raspy.alive = false;
		require('./debug.js').log(5, 'mem', '[' + accountID + '] raspyID and its devices dead: ' + raspyID);
	}
	
	for (var ardID in raspy.arduinos) {
		if (raspy.arduinos.hasOwnProperty(ardID))
			this.setArduinoDead(accountID, raspyID, ardID);
	}
}

/* send status of all devices over RCP to Cloud (only raspy) */
Mem.prototype.sendRCPAllDeviceStatus = function(rcpclient) {
	var accountID = this.config.cloud.id;
	var raspyID = require('./config.js').rcpclient.vpnID.split('-')[1];
	
	var arduinos = this.devices[accountID].raspys[raspyID].arduinos;
	for (var ardID in arduinos) {
		if (arduinos.hasOwnProperty(ardID)) {
			var devices = arduinos[ardID].devices;
			for (var devID in devices) {
				if (devices.hasOwnProperty(devID)){
					var device = devices[devID];
				
					if (device.alive == true) {
						rcpclient.sendDeviceStatus(this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID]);
						//this needs to be removed.
						this.components.getFacility('debug').log(5, 'mem', '[' + accountID + '] Device found to update Cloud, ardID: ' + 
								device.ardID + ' on raspyID: ' + device.raspyID + ' devID: ' + device.devID);
					}
				}
			}
		}
	}
}

/* set pending arduino information. Could be used for the first time arduino is seen or
   every other time */
Mem.prototype.updatePendingArduino = function(ardIP) {
	var pending = this.devices[this.accountID].raspys[this.raspyID].pending;
	var date = new Date();
	if (typeof(pending[ardIP]) == 'undefined') {
		pending[ardIP] = {};
		pending[ardIP].allowed = false;
		pending[ardIP].lastDate = date.getTime();
		pending[ardIP].firstDate = date.getTime();
	} else {
		pending[ardIP].lastDate = date.getTime();
	}
	sendPendingArduinoUpdate(this.raspyID, ardIP)
}

/**
 * Checkinf if pending Arduino is allowed to register (raspy only function)
 */
Mem.prototype.isPendingArduinoAllowed = function(ardIP) {
	var pending = this.devices[this.accountID].raspys[this.raspyID].pending;
	if (typeof(pending[ardIP]) == 'undefined')
		return false;
	
	return pending[ardIP].allowed;
}

/**
 *	Set this pending arduino to be allowed to register (both raspy and cloud function)
 */ 
Mem.prototype.allowPendingArduino = function(accountID, raspyID, ardIP) {
	var pending = this.devices[accountID].raspys[raspyID].pending;
	pending[ardIP].allowed = true;
}

/**
 * Remove pending arduino information from the mem structure (both raspy and cloud function)
 */
Mem.prototype.removePendingArduino = function(accountID, raspyID, ardIP) {
	var pending = this.devices[accountID].raspys[raspyID].pending;
	delete pending[ardIP];
}

/**
 * Update arduino information in the mem structure (both raspy and cloud function)
 * trigger also DB entry update.
 */
Mem.prototype.updateArduino = function(accountID, raspyID, ardID, name) {
	var arduino = this.devices[accountID].raspys[raspyID].arduinos[ardID];
	
	arduino.name = name;
}

/**
 * Clear the discovered flag, so that it doesn't appear anymore in discovered devices tab.
 *
 */
Mem.prototype.clearDeviceDiscovered = function(accountID, raspyID, ardID, devID) {
	var device = this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID];

	device.discovered = false;
}

module.exports = memory;
