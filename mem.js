/*
 * This is mem cache module which is used to hold current status of all the devices 
 * in the memory, each device (ardid & devid) has a an entry in the dictionary:
 *
 * this.devices[client][ardid][devid]
 *
 */
 
var Mem = function() {
	this.devices = {};
	this.components = require('./components').setFacility(this, 'mem');
}

var memory = new Mem();

/* function registers new Arduino to the system, should be called every time registration command is received on the ARIF 
   it returns arduino ID
*/
Mem.prototype.registerArduino = function(client, ardIP) {
	// check if the client, device and arduino exists
	if (typeof(this.devices[client]) == 'undefined') {
		ardid = '1'; /* if entered this condition it means this is the first arduino, give it ID "1" */
		this.devices[client] = {};
		this.devices[client][ardid] = {};
		this.devices[client][ardid].ip = ardIP; 
		this.components.getFacility('debug').log(4, 'mem', 'client id: ' + client + 
				', new Arduino registered: ' + ardid + ' from: ' + ardIP);
		return ardid;
	} else { /* if at least one Arduino already registered (check by IP) */
	
		ardidRegistered = this.isArduinoIPRegistered(client, ardIP);
		if (ardidRegistered) {
			this.components.getFacility('debug').log(4, 'mem', 'client id: ' + client + 
				', Arduino from: ' + ardIP + ' registered already as: ' + ardid);
			return ardidRegistered;
		} else { /* new Arduino device (new IP) */
			ardid = '2';
			while (true) {
				if (typeof(this.devices[client][ardid]) == 'undefined') {
					this.devices[client][ardid] = {};
					this.devices[client][ardid].ip = ardIP;
					this.components.getFacility('debug').log(4, 'mem', 'client id: ' + client + 
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
Mem.prototype.isArdIDRegistered = function(client, ardid) {
	if (typeof(this.devices[client][ardid]) == 'undefined') 
		return true;
	else
		return false;
}

/* checks if the IP address where the registration came from was already registered and contains ardid,
   in such case, function returns ardid */
Mem.prototype.isArduinoIPRegistered = function(client, ip) {
	for (var ardid in this.devices[client]) {
		if (this.devices[client].hasOwnProperty(ardid)) {
			if (this.devices[client][ardid].ip == ip) {
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
Mem.prototype.setDeviceStatus = function(client, devid, ardid, devType, dataType, value, date, ip) {

	// check if the client, device and arduino exists
	if (typeof(this.devices[client]) == 'undefined') {
		this.components.getFacility('debug').log(1, 'mem', 'received request from unknown client: ' + client + 
				' from IP: ' + ip);
		return;
	}
	if (typeof(this.devices[client][ardid]) == 'undefined') {
		this.components.getFacility('debug').log(1, 'mem', 'existing client id: ' + client + ', received message from unregistered Arduino: ' + 
				ardid + ' device: ' + devid + ' IP: ' + ip);
		return;
	}
	if (typeof(this.devices[client][ardid][devid]) == 'undefined') {
		this.devices[client][ardid][devid] = {};
		this.devices[client][ardid][devid].desc = '';
		this.devices[client][ardid][devid].activated = false;
		this.devices[client][ardid][devid].ip = ip;
		this.devices[client][ardid][devid].devType = devType;
		this.devices[client][ardid][devid].dataType = dataType;
		this.devices[client][ardid][devid].ardid = ardid;
		this.devices[client][ardid][devid].devid = devid;
		this.components.getFacility('debug').log(4, 'mem', 'existing client id: ' + client + ', existing Arduino registered: ' + 
				ardid + ' and new device: ' + devid);
	}
	
	// save the old value for later comparison
	var oldValue = this.devices[client][ardid][devid].value
	
	this.devices[client][ardid][devid].value = value;
	
	this.devices[client][ardid][devid].date = {
		y 	: date.getFullYear(),
		m 	: date.getMonth() + 1,
		day : date.getUTCDate(),
		h 	: date.getHours(),
		min : date.getMinutes(),
		s 	: date.getSeconds(),
		ms 	: date.getMilliseconds()
	}
	
	// when we detect that the new value is different then the old one.
	if (oldValue != this.devices[client][ardid][devid].value) {
		onValueChange(client, devid, ardid, this.devices[client][ardid][devid])
		this.components.getFacility('debug').log(5, 'mem', 
			'For client id: ' + client + ', Arduino: "' + ardid + '", Device: "' + devid +
			'" Record updated -> IP: ' + this.devices[client][ardid][devid].ip + 
			' devType: ' + this.devices[client][ardid][devid].devType +
			' dataType: ' + this.devices[client][ardid][devid].dataType +
			' valule: ' + this.devices[client][ardid][devid].value +
			' date: ' + JSON.stringify(this.devices[client][ardid][devid].date));
	}
}

/* function executed if the new value of the mem cache is different than the old one.
   The output interfaces, like the backend need to be updated */
function onValueChange(client, devid, ardid, device) {
	io = this.components.getFacility('backend').io;
	io.of('/iot').to(client).emit('device', device);
}

/* return mem cache object of a single device based on ardid, devid */
Mem.prototype.getDeviceStatus = function(client, ardid, devid) {
	if (typeof(this.devices[client][ardid]) == 'undefined') {
		return;
	} else if (this.devices[client][ardid][devid] == 'undefined') {
		return;
	}
	
	return this.devices[client][ardid][devid];
}

/* return the whole devices structure */
Mem.prototype.getDeviceStatusAll = function() {
	return this.devices;
}

Mem.prototype.getClientDevices = function (client) {
	return this.devices[client]
}

module.exports = memory;
