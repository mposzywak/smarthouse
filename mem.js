/*
 * This is mem cache module which is used to hold current status of all the devices 
 * in the memory, each device (ardID & devID) has a an entry in the dictionary:
 *
 * this.devices[accountID][ardID][devID]
 *
 */
 
var Mem = function() {
	this.devices = {};
	var devices = this.devices;
	var mem = this;
	this.components = require('./components').setFacility(this, 'mem');
	this.config = require('./config.js');
	//this.raspyID = require('./config.js').cloud.raspy;
    // raspyID parameter is only used by ARiF related function, so this setting on the cloud doesn't matter.
	this.db = require('./configdb.js');
	
	if (!this.config.cloud.enabled) {
		this.raspyID = require('./config.js').rcpclient.vpnID.split('-')[1];
		this.accountID = this.config.cloud.id;
		var accountID = this.accountID;
		this.db.getAllAccountDevices(this.accountID, function(error, raspys) {
			if (error) {
				require('./debug.js').log(1, 'configdb', 'Failed to access configDB: ' + error.message);
			} else {
				devices[accountID] = raspys;
				require('./debug.js').log(1, 'configdb', 'ConfigDB contents loaded succesfully');
			}
		});
		this.rcpclient = require('./rcpclient.js');
	} else {
		this.db.getEverything(function(error, accounts) {
			if (error != null) {
				require('./debug.js').log(1, 'configdb', 'Failed to access configDB: ' + error.message);
			} else {
				
				mem['devices'] = accounts;
				require('./debug.js').log(1, 'configdb', 'ConfigDB contents loaded succesfully');
				//console.log('accounts: ' + JSON.stringify(devices));
			}
		});
	}
    //this.raspyID = this.raspyid.split('-')[0];
    
	//this.db = require('./configdb.js');
	
}

var memory = new Mem();

/* function registers new Arduino to the system, should be called every time registration command is received on the ARIF 
   it returns arduino ID
*/
Mem.prototype.registerArduino = function(accountID, IP) {
	// check if the accountID, device and arduino exists
	if (typeof(this.devices[accountID][this.raspyID]) == 'undefined') {
		var ardID = '1'; /* if entered this condition it means this is the first arduino, give it ID "1" */
		this.devices[accountID].raspys = {};
		this.devices[accountID].raspys[this.raspyID] = {};
		this.devices[accountID].raspys[this.raspyID].arduinos = {};
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID] = {};
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices = {};
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].IP = IP; 
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
					this.db.insertArduino(accountID, this.raspyID, IP, ardID);
					this.components.getFacility('debug').log(4, 'mem', 'accountID id: ' + accountID + 
							', new Arduino registered: ' + ardID + ' from: ' + IP);
					return ardID;
				}
				ardIDDec = parseInt(ardID, 16);
				ardIDDec += 1
				ardID = ardidDec.toString(16);
				/* we can register only 250 arduinos */
				if (ardID == 'fa') return 0; /* fa is 250 */
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
	var arduino = this.devices[accountID].raspys[this.raspyID].arduinos[ardID];
	if (!arduino)
		return;
	else
		return this.devices[accountID].raspys[this.raspyID].arduinos[ardID].IP;
}

Mem.prototype.updateArduinoIP = function(accountID, ardID, IP) {
	var arduino = this.devices[accountID].raspys[this.raspyID].arduinos[ardID].IP = IP;
	var devices = this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices;
	for (var devID in devices) {
		if (devices.hasOwnProperty(devID)) {
			devices[devID].IP = IP;
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

/* the method puts the latest status into the mem cache 
	Ideally it takes as arguments, URL of the incoming request (should already be validated)
	IP address and the time the request came. 
	URL - can be taken from req.originalUrl of express req object.
	IP  - can be taken from req.connection.remoteAddress of express req object.
	date - when the GET has been received
*/
Mem.prototype.setDeviceStatus = function(accountID, devID, ardID, devType, dataType, value, date, IP) {
	var isDeviceNew = false;
	var db = this.db;
	// check if the accountID, device and arduino exists
/*	if (typeof(this.devices[accountID]) == 'undefined') {
		this.components.getFacility('debug').log(1, 'mem', 'received request from unknown accountID: ' + accountID + 
				' from IP: ' + IP);
		return;
	}
	if (typeof(this.devices[accountID][this.raspyID][ardID]) == 'undefined') {
		this.components.getFacility('debug').log(1, 'mem', 'existing accountID id: ' + accountID + ', received message from unregistered Arduino: ' + 
				ardID + ' device: ' + devID + ' IP: ' + IP);
		return;
	} */
	if (typeof(this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID]) == 'undefined') {
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID] = {};
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].desc = '';
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].activated = false;
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].IP = IP;
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].devType = devType;
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].dataType = dataType;
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].raspyID = this.raspyID;
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].ardID = ardID;
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].devID = devID;
		isDeviceNew = true;
		this.components.getFacility('debug').log(4, 'mem', 'existing accountID id: ' + accountID + ', existing Arduino registered: ' + 
				ardID + ' and new device: ' + devID);
	}
	
	// save the old value for later comparison
	var oldValue = this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].value
	
	this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].value = value;
	
	this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].date = date.getTime();
	
	// when we detect that the new value is different then the old one.
	if (oldValue != this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].value) {
		onValueChange(accountID, devID, ardID, this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID]);
		if (isDeviceNew) {
			this.db.insertDevice(accountID, this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID]);
		} else {
			this.db.updateDevice(accountID, this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID]);
		}
		this.rcpclient.sendDeviceStatus(this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID]);
		this.components.getFacility('debug').log(5, 'mem', 
			'For accountID id: ' + accountID + ', Arduino: "' + ardID + '", Device: "' + devID +
			'" Record updated by ARIF -> IP: ' + this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].IP + 
			' devType: ' + this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].devType +
			' dataType: ' + this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].dataType +
			' valule: ' + this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].value +
			' date: ' + JSON.stringify(this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].date));
	}
}

/* set new device. This procedure is initiated on CMD 0x32 devMapping */
Mem.prototype.setDevice = function(accountID, devID, ardID, devType, date, IP, controlledDevs) {
	/* no need to check for arduinoID or accountID in devices structure */
	if (typeof(this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID]) == 'undefined') {
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID] = {};
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].desc = '';
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices[devID].activated = false;
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
	if (typeof(this.devices[accountID][raspyID].arduinos[device.ardID]) == 'undefined') {
		this.devices[accountID].raspys[raspyID].arduinos[device.ardID] = {};
		this.devices[accountID].raspys[raspyID].arduinos[device.ardID].devices = {};
		this.devices[accountID].raspys[raspyID].arduinos[device.ardID].IP = device.IP;
	}
	
	this.devices[accountID].raspys[raspyID].arduinos[device.ardID].devices[device.devID] = device;
	onValueChange(accountID, device.devID, device.ardID, this.devices[accountID].raspys[raspyID].arduinos[device.ardID].devices[device.devID]);
	this.components.getFacility('debug').log(5, 'mem', 
			'For accountID: ' + accountID + 'raspyID: ' + raspyID + ', Arduino: "' + device.ardID + '", Device: "' + device.devID +
			'" Record updated by RCP -> IP: ' + this.devices[accountID].raspys[raspyID][device.ardID].devices[device.devID].IP + 
			' devType: ' + this.devices[accountID].raspys[raspyID].arduinos[device.ardID].devices[device.devID].devType +
			' dataType: ' + this.devices[accountID].raspys[raspyID].arduinos[device.ardID].devices[device.devID].dataType +
			' value: ' + this.devices[accountID].raspys[raspyID].arduinos[device.ardID].devices[device.devID].value +
			' date: ' + JSON.stringify(this.devices[accountID].raspys[raspyID].arduinos[device.ardID].devices[device.devID].date));
}


/* function executed if the new value of the mem cache is different than the old one.
   The output interfaces, like the backend need to be updated */
function onValueChange(accountID, devID, ardID, device) {
	io = this.components.getFacility('backend').io;
	io.of('/iot').to(accountID).emit('device', device);
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

Mem.prototype.increaseDeadCounter = function(accountID, raspyID, ardID) {
	if (!this.devices[accountID].raspys[raspyID].arduinos[ardID].counter)
		this.devices[accountID].raspys[raspyID].arduinos[ardID].counter = 0
	
	if (this.devices[accountID].raspys[raspyID].arduinos[ardID].counter < 3)
		this.devices[accountID].raspys[raspyID].arduinos[ardID].counter += 1;
	
	if (this.devices[accountID].raspys[raspyID].arduinos[ardID].counter == 3)
		this.setArduinoDead(accountID, raspyID, ardID);
		
}

Mem.prototype.clearDeadCounter = function(accountID, raspyID, ardID) {
	this.devices[accountID].raspys[raspyID].arduinos[ardID].counter = 0
	this.setArduinoAlive(accountID, raspyID, ardID);
}

/* sets a given Arduino status dead and all its devices */
Mem.prototype.setArduinoDead = function(accountID, raspyID, ardID) {
	this.devices[accountID].raspys[raspyID].arduinos[ardID].alive = false;
	for (var devID in this.devices[accountID].raspys[raspyID].arduinos[ardID].devices) {
		if (this.devices[accountID].raspys[raspyID].arduinos[ardID].devices.hasOwnProperty(devID)){
			var device = this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID];
			
			if (device.alive == true || typeof(device.alive) == 'undefined') {
				this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID].alive = false;
				onValueChange(accountID, raspyID, ardID, device);
				this.components.getFacility('debug').log(5, 'mem', '[' + accountID + '] ArdID and its devIDs declared dead: ' + 
						ardID + ' on raspyID: ' + raspyID + 'devID: ' + devID);
			}
		}
	}
}

/* sets a given Arduino status alive and all its devices */
Mem.prototype.setArduinoAlive = function(accountID, raspyID, ardID) {
	this.devices[accountID].raspys[raspyID].arduinos[ardID].alive = true;
		for (var devID in this.devices[accountID].raspys[raspyID].arduinos[ardID].devices) {
		if (this.devices[accountID].raspys[raspyID].arduinos[ardID].devices.hasOwnProperty(devID)){
			var device = this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID];
			
			if (device.alive == false || typeof(device.alive) == 'undefined') {
				device.alive = true;
				this.components.getFacility('debug').log(5, 'mem', '[' + accountID + '] ArdID and its devIDs declared alive: ' + 
						ardID + ' on raspyID: ' + raspyID + 'devID: ' + devID);
				onValueChange(accountID, raspyID, ardID, device);
			}
		}
	}
}


module.exports = memory;
