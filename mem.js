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
Mem.prototype.registerArduino = function(client) {
	// check if the client, device and arduino exists
	if (typeof(this.devices[client]) == 'undefined') {
		ardid = '1'; /* if entered this condition it means this is the first arduino, give it ID "1" */
		this.devices[client] = {};
		this.devices[client][ardid] = {};
		this.components.getFacility('debug').log(4, 'mem', 'client id: ' + client + 
				', new Arduino registered: ' + ardid);
		return ardid;
	} else {
		ardid = '2';
		while (true) {
			if (typeof(this.devices[client][ardid]) == 'undefined') {
				this.devices[client][ardid] = {};
				this.components.getFacility('debug').log(4, 'mem', 'client id: ' + client + 
						', new Arduino registered: ' + ardid);
				return ardid;
			}
			ardidDec = parseInt(ardid, 16);
			ardidDec+=1
			ardid = ardidDec.toString(16);
			/* we can register only 250 arduinos */
			if (ardid == 'fa') return 0; /* fa is 250 */
		}
	}
}

/* check if Arduino has been registered already */
Mem.prototype.isArduinoRegistered = function(client, ardid) {
	if (typeof(this.devices[client][ardid]) == 'undefined') 
		return true;
	else
		return false;
}

/* the method puts the latest status into the mem cache 
	Ideally it takes as arguments, URL of the incoming request (should already be validated)
	IP address and the time the request came. 
	URL - can be taken from req.originalUrl of express req object.
	IP  - can be taken from req.connection.remoteAddress of express req object.
	date - when the GET has been received
*/
Mem.prototype.setDeviceStatus = function(client, url, date, ip) {
	urlSplitted = url.split('/');
	ardid = urlSplitted[1];
	devid = urlSplitted[2];
	
	// check if the client, device and arduino exists
	if (typeof(this.devices[client]) == 'undefined') {
		this.devices[client] = {};
		this.components.getFacility('debug').log(4, 'mem', 'new client id: ' + client + ', new Arduino registered: ' + 
				ardid + ' and new device: ' + devid);
	}
	if (typeof(this.devices[client][ardid]) == 'undefined') {
		this.devices[client][ardid] = {};
		this.components.getFacility('debug').log(4, 'mem', 'existing client id: ' + client + ', new Arduino registered: ' + 
				ardid + ' and new device: ' + devid);
	}
	if (typeof(this.devices[client][ardid][devid]) == 'undefined') {
		this.devices[client][ardid][devid] = {};
		this.components.getFacility('debug').log(4, 'mem', 'existing client id: ' + client + ', existing Arduino registered: ' + 
				ardid + ' and new device: ' + devid);
	}
	
	// save the old value
	var oldValue = this.devices[client][ardid][devid].value
	
	// fill the mem cache subsctructure
	this.devices[client][ardid][devid].ip = ip;
	this.devices[client][ardid][devid].devType = urlSplitted[4];
	this.devices[client][ardid][devid].dataType = urlSplitted[5];
	this.devices[client][ardid][devid].value = urlSplitted[6];
	this.devices[client][ardid][devid].ardid = ardid;
	this.devices[client][ardid][devid].devid = devid;
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
	io.of('/iot').to(client).emit('value', device);
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
