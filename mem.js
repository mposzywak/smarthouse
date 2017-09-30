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
				require('./debug.js').log(1, 'configdb', 'configDB contents loaded succesfully');
			}
		});
	}
    //this.raspyID = this.raspyid.split('-')[0];
    this.rcpclient = require('./rcpclient.js');
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
		//this.devices[accountID] = {};
		this.devices[accountID][this.raspyID] = {};
		this.devices[accountID][this.raspyID][ardID] = {};
		this.devices[accountID][this.raspyID][ardID].IP = IP; 
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
				if (typeof(this.devices[accountID][this.raspyID][ardID]) == 'undefined') {
					this.devices[accountID][this.raspyID][ardID] = {};
					this.devices[accountID][this.raspyID][ardID].IP = IP;
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
	if (typeof(this.devices[accountID][this.raspyID][ardID]) == 'undefined') 
		return true;
	else
		return false;
}

/* checks if the IP address where the registration came from was already registered and contains ardID,
   in such case, function returns ardID */
Mem.prototype.isArduinoIPRegistered = function(accountID, IP) {
	for (var ardID in this.devices[accountID][this.raspyID]) {
		if (this.devices[accountID][this.raspyID].hasOwnProperty(ardID)) {
			if (this.devices[accountID][this.raspyID][ardID].IP == IP) {
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
	if (typeof(this.devices[accountID][this.raspyID][ardID][devID]) == 'undefined') {
		this.devices[accountID][this.raspyID][ardID][devID] = {};
		this.devices[accountID][this.raspyID][ardID][devID].desc = '';
		this.devices[accountID][this.raspyID][ardID][devID].activated = false;
		this.devices[accountID][this.raspyID][ardID][devID].IP = IP;
		this.devices[accountID][this.raspyID][ardID][devID].devType = devType;
		this.devices[accountID][this.raspyID][ardID][devID].dataType = dataType;
		this.devices[accountID][this.raspyID][ardID][devID].raspyID = this.raspyID;
		this.devices[accountID][this.raspyID][ardID][devID].ardID = ardID;
		this.devices[accountID][this.raspyID][ardID][devID].devID = devID;
		isDeviceNew = true;
		this.components.getFacility('debug').log(4, 'mem', 'existing accountID id: ' + accountID + ', existing Arduino registered: ' + 
				ardID + ' and new device: ' + devID);
	}
	
	// save the old value for later comparison
	var oldValue = this.devices[accountID][this.raspyID][ardID][devID].value
	
	this.devices[accountID][this.raspyID][ardID][devID].value = value;
	
	this.devices[accountID][this.raspyID][ardID][devID].date = {
		y 	: date.getFullYear(),
		m 	: date.getMonth() + 1,
		day : date.getUTCDate(),
		h 	: date.getHours(),
		min : date.getMinutes(),
		s 	: date.getSeconds(),
		ms 	: date.getMilliseconds()
	}
	
	// when we detect that the new value is different then the old one.
	if (oldValue != this.devices[accountID][this.raspyID][ardID][devID].value) {
		onValueChange(accountID, devID, ardID, this.devices[accountID][this.raspyID][ardID][devID]);
		if (isDeviceNew) {
			this.db.insertDevice(accountID, this.devices[accountID][this.raspyID][ardID][devID]);
		} else {
			this.db.updateDevice(accountID, this.devices[accountID][this.raspyID][ardID][devID]);
		}
		this.rcpclient.sendDeviceStatus(this.devices[accountID][this.raspyID][ardID][devID]);
		this.components.getFacility('debug').log(5, 'mem', 
			'For accountID id: ' + accountID + ', Arduino: "' + ardID + '", Device: "' + devID +
			'" Record updated by ARIF -> IP: ' + this.devices[accountID][this.raspyID][ardID][devID].IP + 
			' devType: ' + this.devices[accountID][this.raspyID][ardID][devID].devType +
			' dataType: ' + this.devices[accountID][this.raspyID][ardID][devID].dataType +
			' valule: ' + this.devices[accountID][this.raspyID][ardID][devID].value +
			' date: ' + JSON.stringify(this.devices[accountID][this.raspyID][ardID][devID].date));
	}
}

/* set new device. This procedure is initiated on CMD 0x32 devMapping */
Mem.prototype.setDevice = function(accountID, devID, ardID, devType, date, IP, controlledDevs) {
	/* no need to check for arduinoID or accountID in devices structure */
	if (typeof(this.devices[accountID][this.raspyID][ardID][devID]) == 'undefined') {
		this.devices[accountID][this.raspyID][ardID][devID] = {};
		this.devices[accountID][this.raspyID][ardID][devID].desc = '';
		this.devices[accountID][this.raspyID][ardID][devID].activated = false;
		this.devices[accountID][this.raspyID][ardID][devID].IP = IP;
		this.devices[accountID][this.raspyID][ardID][devID].devType = devType;
		this.devices[accountID][this.raspyID][ardID][devID].controlledDevs = '';
		this.devices[accountID][this.raspyID][ardID][devID].raspyID = this.raspyID;
		this.devices[accountID][this.raspyID][ardID][devID].ardID = ardID;
		this.devices[accountID][this.raspyID][ardID][devID].devID = devID;
		this.devices[accountID][this.raspyID][ardID][devID].date = {
			y 	: date.getFullYear(),
			m 	: date.getMonth() + 1,
			day : date.getUTCDate(),
			h 	: date.getHours(),
			min : date.getMinutes(),
			s 	: date.getSeconds(),
			ms 	: date.getMilliseconds()
		}
		
		for (var i in controlledDevs) {
			console.log(i);
			this.devices[accountID][this.raspyID][ardID][devID].controlledDevs += controlledDevs[i] + ' ';
		}
		
		this.db.insertDevice(accountID, this.devices[accountID][this.raspyID][ardID][devID])
		this.components.getFacility('debug').log(5, 'mem', 
			'[' + accountID + '] ardID: "' + ardID + '", devID: "' + devID +
			' registered by ARIF -> IP: ' + this.devices[accountID][this.raspyID][ardID][devID].IP + 
			' devType: ' + this.devices[accountID][this.raspyID][ardID][devID].devType +
			' date: ' + JSON.stringify(this.devices[accountID][this.raspyID][ardID][devID].date));
		
	} else {
		/* exit function as it looks like the device is already registered/mapped in the DB */
		this.components.getFacility('debug').log(4, 'mem', 'accountID id: ' + accountID + ', Arduino: ' + 
				ardID + ' existing devID mapping came: ' + devID);
		return;
	}
}

/* set device status. Executed when the data is coming from RCP */
Mem.prototype.setRCPDeviceStatus = function(vpnid, raspyip, device) {
	accountID = vpnid.split('-')[0];
	raspyID = vpnid.split('-')[1];
	//console.log('vpnid = ' + vpnid);
	//console.log('accountID = ' + accountID);
	//console.log('raspyID = ' + raspyid);
	//console.log('devID = ' + device.devID);
	
	// TODO: put here the limitations on the number of devices, raspys, arduinos, etc...
	if (typeof(this.devices[accountID]) == 'undefined') {
		this.devices[accountID] = {}
	}
	if (typeof(this.devices[accountID][raspyID]) == 'undefined') {
		this.devices[accountID][raspyID] = {}
		this.devices[accountID][raspyID].IP = raspyip
	}
	if (typeof(this.devices[accountID][raspyID][device.ardID]) == 'undefined') {
		this.devices[accountID][raspyID][device.ardID] = {}
		this.devices[accountID][raspyID][device.ardID].IP = device.IP;
	}
	
	this.devices[accountID][raspyID][device.ardID][device.devID] = device;
	onValueChange(accountID, device.devID, device.ardID, this.devices[accountID][raspyID][device.ardID][device.devID]);
	this.components.getFacility('debug').log(5, 'mem', 
			'For accountID: ' + accountID + 'raspyID: ' + raspyID + ', Arduino: "' + device.ardID + '", Device: "' + device.devID +
			'" Record updated by RCP -> IP: ' + this.devices[accountID][raspyID][device.ardID][device.devID].IP + 
			' devType: ' + this.devices[accountID][raspyID][device.ardID][device.devID].devType +
			' dataType: ' + this.devices[accountID][raspyID][device.ardID][device.devID].dataType +
			' value: ' + this.devices[accountID][raspyID][device.ardID][device.devID].value +
			' date: ' + JSON.stringify(this.devices[accountID][raspyID][device.ardID][device.devID].date));
}


/* function executed if the new value of the mem cache is different than the old one.
   The output interfaces, like the backend need to be updated */
function onValueChange(accountID, devID, ardID, device) {
	io = this.components.getFacility('backend').io;
	io.of('/iot').to(accountID).emit('device', device);
}

/* return mem cache object of a single device based on ardID, devID */
Mem.prototype.getDeviceStatus = function(accountID, raspyID, ardID, devID) {
	if (typeof(this.devices[accountID][raspyID][ardID]) == 'undefined') {
		return;
	} else if (this.devices[accountID][raspyID][ardID][devID] == 'undefined') {
		return;
	}
	
	return this.devices[accountID][this.raspyID][ardID][devID];
}

/* return the whole devices structure */
Mem.prototype.getDeviceStatusAll = function() {
	return this.devices;
}

Mem.prototype.getClientDevices = function (accountID) {
	return this.devices[accountID];
}

module.exports = memory;
