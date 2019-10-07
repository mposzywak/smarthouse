

var BFP = function() {
	this.components = require('./components.js').setFacility(this, 'bfp');
}

var bfp = new BFP();

const BFP_DEVICE_STATUS = "BFP_DEVICE_STATUS";
const BFP_CLOUD_STATUS = "BFP_CLOUD_STATUS";

/* set new init, takes string */
BFP.prototype.BFPValidateDeviceCommand = function() {

}

/**
 * Create new deviceStatus message, can be triggered in two occasions:
 * - at ARiF inbound message: 
 *				function(devID, ardID, raspyID, devType, dataType, value, reqDate, srcIP)
 * - at Mem originated status change, re-connect, ack, etc: 
 * 				function(devID, ardID, raspyID, devType, dataType, value, reqDate, srcIP, activated, alive, user, desc)
 */
BFP.prototype.BFPCreateDeviceStatus = function(devID, ardID, raspyID, devType, dataType, value, reqDate, srcIP, user, activated, alive, desc) {
	var message = {};
	message.header = {};
	message.header.code = BFP_DEVICE_STATUS;
	message.header.user = user;
	message.body = {};
	message.body.raspyID = raspyID;
	message.body.ardID = ardID;
	message.body.devID = devID;
	message.body.devType = devType;
	message.body.dataType = dataType;
	message.body.value = value;
	message.body.date = reqDate;
	message.body.IP = srcIP;
	if (activated)
		message.body.activated = activated;
	else
		message.body.activated = false;
	if (alive) 
		message.body.alive = alive;
	else
		message.body.alive = true;
	if (desc)
		message.body.desc = desc;
	else
		message.body.desc = "";

	return message;
}

BFP.prototype.BFPCreateDeviceStatusFromMem = function(device) {
	message = {};
	message.header = {};
	message.header.code = BFP_DEVICE_STATUS;
	message.body = {};
	message.body.raspyID = device.raspyID;
	message.body.ardID = device.ardID;
	message.body.devID = device.devID;
	message.body.devType = device.devType;
	message.body.dataType = device.dataType;
	message.body.value = device.value;
	message.body.date = device.reqDate;
	message.body.IP = device.IP;
	message.body.activated = device.activated;
	message.body.alive = device.alive;
	message.body.desc = device.desc;
	if (device.discovered) {
		message.body.discovered = device.discovered;
	}

	return message;
}

BFP.prototype.BFPCreateCloudStatus = function(enabled, status, host, port, vpnID, response) {
	message = {};
	message.header = {};
	message.header.code = BFP_CLOUD_STATUS;

	if (enabled) {
		message.header.enabled = enabled;
		message.header.status = status;
		message.header.host = host;
		message.header.port = port;
		message.header.vpnID = vpnID;
		message.header.response = response;
	} else {
		message.header.enabled = false;
	}
	
	return message;
}

BFP.prototype.BFPFlagUserOriginated = function(BFPDeviceStatus) {

}




module.exports = bfp;