/*
 * This is mem cache module which is used to hold current status of all the devices 
 * in the memory, each device (ardid & devid) has a an entry in the dictionary:
 *
 * this.devices[accountID][ardid][devid]
 *
 */
 
var Mem = function() {
	this.devices = {};
	this.components = require('./components').setFacility(this, 'mem');
	this.config = require('./config.js');
	//this.raspyid = require('./config.js').cloud.raspy;
    // raspyID parameter is only used by ARiF related function, so this setting on the cloud doesn't matter.
	this.raspyid = require('./config.js').rcpclient.vpnID.split('-')[1];
    //this.raspyid = this.raspyid.split('-')[0];
    this.rcpclient = require('./rcpclient.js');
}

var memory = new Mem();

/* function registers new Arduino to the system, should be called every time registration command is received on the ARIF 
   it returns arduino ID
*/
Mem.prototype.registerArduino = function(accountID, ardIP) {
	// check if the accountID, device and arduino exists
	if (typeof(this.devices[accountID]) == 'undefined') {
		ardid = '1'; /* if entered this condition it means this is the first arduino, give it ID "1" */
		this.devices[accountID] = {};
		this.devices[accountID][this.raspyid] = {};
		this.devices[accountID][this.raspyid][ardid] = {};
		this.devices[accountID][this.raspyid][ardid].ip = ardIP; 
		this.components.getFacility('debug').log(4, 'mem', 'accountID id: ' + accountID + 
				', new Arduino registered: ' + ardid + ' from: ' + ardIP);
		return ardid;
	} else { /* if at least one Arduino already registered (check by IP) */
	
		ardidRegistered = this.isArduinoIPRegistered(accountID, ardIP);
		if (ardidRegistered) {
			this.components.getFacility('debug').log(4, 'mem', 'accountID id: ' + accountID + 
				', Arduino from: ' + ardIP + ' registered already as: ' + ardid);
			return ardidRegistered;
		} else { /* new Arduino device (new IP) */
			ardid = '2';
			while (true) {
				if (typeof(this.devices[accountID][this.raspyid][ardid]) == 'undefined') {
					this.devices[accountID][this.raspyid][ardid] = {};
					this.devices[accountID][this.raspyid][ardid].ip = ardIP;
					this.components.getFacility('debug').log(4, 'mem', 'accountID id: ' + accountID + 
							', new Arduino registered: ' + ardid + ' from: ' + ardIP);
					return ardid;
				}
				ardidDec = parseInt(ardid, 16);
				ardidDec += 1
				ardid = ardidDec.toString(16);
				/* we can register only 250 arduinos */
				if (ardid == 'fa') return 0; /* fa is 250 */
			}
		}
	}
}

/* check if Arduino has been registered already */
Mem.prototype.isArdIDRegistered = function(accountID, ardid) {
	if (typeof(this.devices[accountID][this.raspyid][ardid]) == 'undefined') 
		return true;
	else
		return false;
}

/* checks if the IP address where the registration came from was already registered and contains ardid,
   in such case, function returns ardid */
Mem.prototype.isArduinoIPRegistered = function(accountID, ip) {
	for (var ardid in this.devices[accountID][this.raspyid]) {
		if (this.devices[accountID][this.raspyid].hasOwnProperty(ardid)) {
			if (this.devices[accountID][this.raspyid][ardid].ip == ip) {
				return ardid;
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
Mem.prototype.setDeviceStatus = function(accountID, devid, ardid, devType, dataType, value, date, ip) {

	// check if the accountID, device and arduino exists
	if (typeof(this.devices[accountID]) == 'undefined') {
		this.components.getFacility('debug').log(1, 'mem', 'received request from unknown accountID: ' + accountID + 
				' from IP: ' + ip);
		return;
	}
	if (typeof(this.devices[accountID][this.raspyid][ardid]) == 'undefined') {
		this.components.getFacility('debug').log(1, 'mem', 'existing accountID id: ' + accountID + ', received message from unregistered Arduino: ' + 
				ardid + ' device: ' + devid + ' IP: ' + ip);
		return;
	}
	if (typeof(this.devices[accountID][this.raspyid][ardid][devid]) == 'undefined') {
		this.devices[accountID][this.raspyid][ardid][devid] = {};
		this.devices[accountID][this.raspyid][ardid][devid].desc = '';
		this.devices[accountID][this.raspyid][ardid][devid].activated = false;
		this.devices[accountID][this.raspyid][ardid][devid].ip = ip;
		this.devices[accountID][this.raspyid][ardid][devid].devType = devType;
		this.devices[accountID][this.raspyid][ardid][devid].dataType = dataType;
		this.devices[accountID][this.raspyid][ardid][devid].ardid = ardid;
		this.devices[accountID][this.raspyid][ardid][devid].devid = devid;
		this.components.getFacility('debug').log(4, 'mem', 'existing accountID id: ' + accountID + ', existing Arduino registered: ' + 
				ardid + ' and new device: ' + devid);
	}
	
	// save the old value for later comparison
	var oldValue = this.devices[accountID][this.raspyid][ardid][devid].value
	
	this.devices[accountID][this.raspyid][ardid][devid].value = value;
	
	this.devices[accountID][this.raspyid][ardid][devid].date = {
		y 	: date.getFullYear(),
		m 	: date.getMonth() + 1,
		day : date.getUTCDate(),
		h 	: date.getHours(),
		min : date.getMinutes(),
		s 	: date.getSeconds(),
		ms 	: date.getMilliseconds()
	}
	
	// when we detect that the new value is different then the old one.
	if (oldValue != this.devices[accountID][this.raspyid][ardid][devid].value) {
		onValueChange(accountID, devid, ardid, this.devices[accountID][this.raspyid][ardid][devid]);
		this.rcpclient.sendDeviceStatus(this.devices[client][this.raspyid][ardid][devid]);
		this.components.getFacility('debug').log(5, 'mem', 
			'For accountID id: ' + accountID + ', Arduino: "' + ardid + '", Device: "' + devid +
			'" Record updated by ARIF -> IP: ' + this.devices[accountID][this.raspyid][ardid][devid].ip + 
			' devType: ' + this.devices[accountID][this.raspyid][ardid][devid].devType +
			' dataType: ' + this.devices[accountID][this.raspyid][ardid][devid].dataType +
			' valule: ' + this.devices[accountID][this.raspyid][ardid][devid].value +
			' date: ' + JSON.stringify(this.devices[accountID][this.raspyid][ardid][devid].date));
	}
}

/* set device status. Executed when the data is coming from RCP */
Mem.prototype.setRCPDeviceStatus = function(vpnid, raspyip, device) {
	accountID = vpnid.split('-')[0];
	raspyid = vpnid.split('-')[1];
	//console.log('vpnid = ' + vpnid);
	//console.log('accountID = ' + accountID);
	//console.log('raspyid = ' + raspyid);
	//console.log('devID = ' + device.devid);
	
	// TODO: put here the limitations on the number of devices, raspys, arduinos, etc...
	if (typeof(this.devices[accountID]) == 'undefined') {
		this.devices[accountID] = {}
	}
	if (typeof(this.devices[accountID][raspyid]) == 'undefined') {
		this.devices[accountID][raspyid] = {}
		this.devices[accountID][raspyid].ip = raspyip
	}
	if (typeof(this.devices[accountID][raspyid][device.ardid]) == 'undefined') {
		this.devices[accountID][raspyid][device.ardid] = {}
		this.devices[accountID][raspyid][device.ardid].ip = device.ip;
	}
	
	this.devices[accountID][raspyid][device.ardid][device.devid] = device;
	onValueChange(accountID, device.devid, device.ardid, this.devices[accountID][raspyid][device.ardid][device.devid]);
	this.components.getFacility('debug').log(5, 'mem', 
			'For accountID: ' + accountID + 'raspyID: ' + raspyid + ', Arduino: "' + device.ardid + '", Device: "' + device.devid +
			'" Record updated by RCP -> IP: ' + this.devices[accountID][raspyid][device.ardid][device.devid].ip + 
			' devType: ' + this.devices[accountID][raspyid][device.ardid][device.devid].devType +
			' dataType: ' + this.devices[accountID][raspyid][device.ardid][device.devid].dataType +
			' valule: ' + this.devices[accountID][raspyid][device.ardid][device.devid].value +
			' date: ' + JSON.stringify(this.devices[accountID][raspyid][device.ardid][device.devid].date));
}


/* function executed if the new value of the mem cache is different than the old one.
   The output interfaces, like the backend need to be updated */
function onValueChange(accountID, devid, ardid, device) {
	io = this.components.getFacility('backend').io;
	io.of('/iot').to(accountID).emit('device', device);
}

/* return mem cache object of a single device based on ardid, devid */
Mem.prototype.getDeviceStatus = function(accountID, ardid, devid) {
	if (typeof(this.devices[accountID][this.raspyid][ardid]) == 'undefined') {
		return;
	} else if (this.devices[accountID][this.raspyid][ardid][devid] == 'undefined') {
		return;
	}
	
	return this.devices[accountID][this.raspyid][ardid][devid];
}

/* return the whole devices structure */
Mem.prototype.getDeviceStatusAll = function() {
	return this.devices;
}

Mem.prototype.getClientDevices = function (accountID) {
	return this.devices[accountID];
}

module.exports = memory;
