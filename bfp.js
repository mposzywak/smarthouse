

var BFP = function() {
	this.components = require('./components.js').setFacility(this, 'bfp');
}

var bfp = new BFP();

const BFP_DEVICE_STATUS = "BFP_DEVICE_STATUS";
const BFP_CLOUD_STATUS = "BFP_CLOUD_STATUS";
const BFP_DEVICE_COMMAND = 'BFP_DEVICE_COMMAND';
const BFP_MQTT_STATUS = 'BFP_MQTT_STATUS';
const BFP_VPNKEY_RESPONSE = 'BFP_VPNKEY_RESPONSE';
const BFP_PUBLIC_KEY = 'BFP_PUBLIC_KEY';
const BFP_CTRL_STATUS = 'BFP_CTRL_STATUS';
const BFP_LIGHT_TYPE = 'BFP_LIGHT_TYPE';
const BFP_LIGHT_INPUT_TYPE = 'BFP_LIGHT_INPUT_TYPE';
const BFP_LIGHT_SETTINGS = 'BFP_LIGHT_SETTINGS';
const BFP_SHADE_SETTINGS = 'BFP_SHADE_SETTINGS';

/* BFP (Backend Frontend Protocol) commands */
const BFP_HEARTBEAT = 'heartbeat';
const BFP_LIGHTON = 'lightON';
const BFP_LIGHTOFF = 'lightOFF';
const BFP_SHADEPOS = 'shadePOS';
const BFP_SHADETILT = 'shadeTILT';
const BFP_SHADEUP = 'shadeUP';		/* not used right now from the front-end */
const BFP_SHADEDOWN = 'shadeDOWN';  /* not used right now from the front-end */
const BFP_SHADESTOP = 'shadeSTOP';  /* not used right now from the front-end */

/* devTypes */
const TYPE_DIGITIN = 'digitIN';
const TYPE_DIGITOUT = 'digitOUT';
const TYPE_SHADE = 'shade';

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

BFP.prototype.BFPCreateLightType = function(devID, ardID, raspyID, lightType) {
	var message = {};
	message.header = {};
	message.header.code = BFP_LIGHT_TYPE;
	message.body = {};
	message.body.raspyID = raspyID;
	message.body.ardID = ardID;
	message.body.devID = devID;
	message.body.lightType = lightType;
	
	return message;
}

BFP.prototype.BFPCreateLightSettings = function(devID, ardID, raspyID, lightType, lightInputType, ctrlON, timer) {
	var message = {};
	message.header = {};
	message.header.code = BFP_LIGHT_SETTINGS;
	message.body = {};
	message.body.raspyID = raspyID;
	message.body.ardID = ardID;
	message.body.devID = devID;
	message.body.lightType = lightType;
	message.body.lightInputType = lightInputType;
	message.body.ctrlON = ctrlON;
	message.body.timer = timer;
	
	return message;
}

BFP.prototype.BFPCreateShadeSettings = function(devID, ardID, raspyID, positionTimer, tiltTimer) {
	var message = {};
	message.header = {};
	message.header.code = BFP_SHADE_SETTINGS;
	message.body = {};
	message.body.raspyID = raspyID;
	message.body.ardID = ardID;
	message.body.devID = devID;
	message.body.positionTimer = positionTimer;
	message.body.tiltTimer = tiltTimer;
	
	return message;
}

BFP.prototype.BFPCreateLightInputType = function(devID, ardID, raspyID, lightInputType) {
	var message = {};
	message.header = {};
	message.header.code = BFP_LIGHT_INPUT_TYPE;
	message.body = {};
	message.body.raspyID = raspyID;
	message.body.ardID = ardID;
	message.body.devID = devID;
	message.body.lightInputType = lightInputType;
	
	return message;
}

BFP.prototype.BFPCreateDeviceStatusFromMem = function(device) {
	message = {};
	message.header = {};
	message.header.code = BFP_DEVICE_STATUS;
	message.body = {};
	message.body = device;

	return message;
}

/* Create a Settings BFP message */
BFP.prototype.BFPCreateSettings = function(ardID, raspyID, version, mode, ctrlON, uptime, restore) {
	message = {};
	message.header = {};
	message.header.code = BFP_CTRL_STATUS;
	message.body = {};
	message.body.ardID = ardID;
	message.body.raspyID = raspyID;
	message.body.version = version;
	message.body.mode = mode;
	message.body.ctrlON = ctrlON;
	message.body.uptime = uptime;
	message.body.restore = restore;
	
	return message;
}

/* Create a Central Control setting BFP message with enable ON */
BFP.prototype.BFPCreateCtrlONEnabled = function(ardID, raspyID) {
	message = {};
	message.header = {};
	message.header.code = BFP_CTRL_STATUS;
	message.header.enabled = true;
	message.body = {};
	message.body.ardID = ardID;
	message.body.raspyID = raspyID;

	return message;
}

/* Create a Central Control setting BFP message with enable OFF */
BFP.prototype.BFPCreateCtrlONDisabled = function(ardID, raspyID) {
	message = {};
	message.header = {};
	message.header.code = BFP_CTRL_STATUS;
	message.header.enabled = false;
	message.body = {};
	message.body.ardID = ardID;
	message.body.raspyID = raspyID;

	return message;
}

/* Create a Cloud Status BFP message */
BFP.prototype.BFPCreateCloudStatus = function(cloud, status, vpnStatus, host, port, vpnID, response, lastError) {
	message = {};
	message.header = {};
	message.header.code = BFP_CLOUD_STATUS;

	if (cloud) {
		message.header.cloud = cloud;
		message.header.status = status;
		message.header.host = host;
		message.header.port = port;
		message.header.vpnID = vpnID;
		message.header.vpnStatus = vpnStatus
		message.header.response = response;
		message.header.lastError = lastError;
	} else {
		message.header.cloud = false;
	}
	
	return message;
}

/* Create a MQTT Connection to the Broker status message */
BFP.prototype.BFPCreateMQTTStatus = function(enabled, status, host) {
	message = {};
	message.header = {};
	message.header.code = BFP_MQTT_STATUS;

	if (enabled) {
		message.header.enabled = enabled;
		message.header.status = status;
		message.header.host = host;
	} else {
		message.header.enabled = false;
	}
	
	return message;
}
/**
 * Create a message for sending vpnKey 
 */
BFP.prototype.BFPVPNKeyResponse = function(vpnKey, status, error) {
	message = {};
	message.header = {};
	message.header.code = BFP_VPNKEY_RESPONSE;
	message.header.status = status;
	
	if (status) {
		message.header.vpnkey = vpnKey;
	} else {
		message.header.error = error;
	}
	
	return message;
}

/**
 * Create a message for sharing the public key for the SSH user with the cloud
 */
BFP.prototype.BFPCreateSendPublicKey = function(key) {
	message = {};
	message.header = {};
	message.body = {};
	message.header.code = BFP_PUBLIC_KEY;
	message.body = key;
	
	return message;
}

BFP.prototype.BFPFlagUserOriginated = function(BFPDeviceStatus) {

}

BFP.prototype.BFPCreateDeviceCommandShade = function(device, value, cmd) {
	var message = {};
	message.header = {};
	message.header.code = BFP_DEVICE_COMMAND;
	message.body = {};
	message.body.raspyID = device.raspyID;
	message.body.ardID = device.ardID;
	message.body.devID = device.devID;
	message.body.devType = device.devType;
	message.body.dataType = 'byte';

	message.header.command = cmd;
	if (cmd == BFP_SHADEPOS)
		message.body.position = value;
	if (cmd == BFP_SHADETILT)
		message.body.tilt = value;
	if (cmd == 'OPEN') {
		message.body.direction = 'up';
		message.header.command = BFP_SHADEUP;
	}
	if (cmd == 'CLOSE') {
		message.body.direction = 'down';
		message.header.command = BFP_SHADEDOWN;
	}
	if (cmd == 'STOP') {
		message.body.direction = 'stop'
		message.header.command = BFP_SHADESTOP;
	}
	
	return message;
}



module.exports = bfp;