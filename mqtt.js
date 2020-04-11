


let MQTT = function() {
	let config = require('./config.js');
	this.mqtt = require('mqtt');
	debug = require('./debug.js');
	if (config.mqtt.enabled) {
		let options = {
			will: {
				topic: config.mqtt.topicPrefix + '/raspy-status',
				payload: 'offline',
				qos: 2,
				retain: true
			}
		};
		this.MQTTDevices = {};
		this.MQTTDevices.raspys = {}
		this.client = this.mqtt.connect(config.mqtt.broker, options);
		let c = this.client;
		
		console.log('mqtt init');
		this.client.on('connect', function() {
			let statusTopic = config.mqtt.topicPrefix + '/status';
			debug.log(4, 'mqtt', 'Connected succesfully to MQTT broker: ' + config.mqtt.broker);
			c.subscribe(statusTopic, {"rap": true}, function(error){
				if (error)
					debug.log(2, 'mqtt', 'Problem with subscribing to topic: ' + statusTopic + ' error: ' + error.toString());
				else
					debug.log(4, 'mqtt', 'Succesfully subscribed to topic: ' + statusTopic);
			});
		});
		this.client.on('error', function(error) {	
			debug.log(1, 'mqtt', 'Problem connecting with MQTT broker: ' + error.toString());
		});
		this.client.on('message', function(topic, payload){
			debug.log(4, 'mqtt', 'Message received: ' + payload + ' from topic: ' + topic);
			if (!verifyTopic(topic)) {
				debug.log(4, 'mqtt', 'Topic in incorrect format, cannot be processed');
				return;
			}
			if (topic.split('/')[0] == 'status'){
				HAStatus(topic, payload);
				return;
			}
			let cmd = topic.split('/')[4];
			if (cmd == 'direction-cmd') {
				directionCommand(topic, payload);
			} else if (cmd == 'position-cmd') {
				positionCommand(topic, payload);
			} else if (cmd == 'tilt-cmd') {
				tiltCommand(topic, payload);
			} else {
				debug.log(1, 'mqtt', 'Unknown CMD received: ' + cmd);
			}
		});
		this.client.on('error', function(error){
			debug.log(1, 'mqtt', 'Unknown Error received: ' + error.toString());
		});
		this.client.on('disconnect', function(){
			debug.log(1, 'mqtt', 'Disconnect packet received from the broker.');
		});
		this.client.on('offline', function(){
			debug.log(1, 'mqtt', 'Broker goes offline.');
		});
	} else {
		debug.log(1, 'mqtt', 'MQTT disabled through configuration');
	}
}

let mqtt = new MQTT();

/** 
 * Function to verify if the topic has the right format and all its contents
 * TODO: implement verification
 */
function verifyTopic(topic) {
	return true;
}

function HAStatus(topic, payload) {
	debug.log(1, 'mqtt', 'Received status information from HA: ' + payload);
	
}

function directionCommand(topic, payload) {
	let bfp = require('./bfp.js');
	let arif = require('./arif.js');
	let mem = require('./mem.js');
	let config = require('./config.js');
	let debug = require('./debug.js');
	let accountID = config.cloud.id;
	let raspyID = topic.split('/')[1];
	let ardID = topic.split('/')[2];
	let devID = topic.split('/')[3];
	let device = mem.getDeviceStatus(accountID, raspyID, ardID, devID);
	if (typeof(device) == 'undefined') {
		/* this situation normally shouldn't happen. It means that we were subscribed to a topic based on mem device, but this device disappeared later */
		debug.log(1, 'mqtt', 'Received MQTT command for unknown device! Doing nothing.');
		return;
	}
	if (require('./mqtt.js').MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[topic].ignorePublish == true) {
		debug.log(5, 'mqtt', 'Ignoring this MQTT message as it is first after connectivity established with Home Assistant.');
		require('./mqtt.js').MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[topic].ignorePublish = false;
		return;
	}
	let BFPDeviceCommand = bfp.BFPCreateDeviceCommandShade(device, null, payload);
	BFPDeviceCommand.body.IP = device.IP;
	arif.sendCommand(BFPDeviceCommand.body, BFPDeviceCommand.header.command, function(message) {
		debug.log(5, 'mqtt', 'Received response from ARiF: ' + JSON.stringify(message));
	});
}

function positionCommand(topic, payload) {
	let bfp = require('./bfp.js');
	let arif = require('./arif.js');
	let mem = require('./mem.js');
	let config = require('./config.js');
	let debug = require('./debug.js');
	let accountID = config.cloud.id;
	let raspyID = topic.split('/')[1];
	let ardID = topic.split('/')[2];
	let devID = topic.split('/')[3];
	let device = mem.getDeviceStatus(accountID, raspyID, ardID, devID);
	if (typeof(device) == 'undefined') {
		/* this situation normally shouldn't happen. It means that we were subscribed to a topic based on mem device, but this device disappeared later */
		debug.log(1, 'mqtt', 'Received MQTT command for unknown device! Doing nothing.');
		return;
	}
	if (require('./mqtt.js').MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[topic].ignorePublish == true) {
		debug.log(5, 'mqtt', 'Ignoring this MQTT message as it is first after connectivity established with Home Assistant.');
		require('./mqtt.js').MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[topic].ignorePublish = false;
		return;
	}
	let BFPDeviceCommand = bfp.BFPCreateDeviceCommandShade(device, payload, 'shadePOS');
	BFPDeviceCommand.body.IP = device.IP;
	arif.sendCommand(BFPDeviceCommand.body, BFPDeviceCommand.header.command, function(message) {
		debug.log(5, 'mqtt', 'Received response from ARiF: ' + JSON.stringify(message));
	});
}

function tiltCommand(topic, payload) {
	let bfp = require('./bfp.js');
	let arif = require('./arif.js');
	let mem = require('./mem.js');
	let config = require('./config.js');
	let debug = require('./debug.js');
	let accountID = config.cloud.id;
	let raspyID = topic.split('/')[1];
	let ardID = topic.split('/')[2];
	let devID = topic.split('/')[3];
	let device = mem.getDeviceStatus(accountID, raspyID, ardID, devID);
	if (typeof(device) == 'undefined') {
		/* this situation normally shouldn't happen. It means that we were subscribed to a topic based on mem device, but this device disappeared later */
		debug.log(1, 'mqtt', 'Received MQTT command for unknown device! Doing nothing.');
		return;
	}
	if (require('./mqtt.js').MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[topic].ignorePublish == true) {
		debug.log(5, 'mqtt', 'Ignoring this MQTT message as it is first after connectivity established with Home Assistant.');
		require('./mqtt.js').MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[topic].ignorePublish = false;
		return;
	}
	let newValue;
	if (payload <= 60)
		newValue = 90;
	else if (payload > 60 && payload <= 120)
		newValue = 45;
	else if (payload > 120) 
		newValue = 0;
	
	let BFPDeviceCommand = bfp.BFPCreateDeviceCommandShade(device, newValue, 'shadeTILT');
	
	BFPDeviceCommand.body.IP = device.IP;
	arif.sendCommand(BFPDeviceCommand.body, BFPDeviceCommand.header.command, function(message) {
		debug.log(5, 'mqtt', 'Received response from ARiF: ' + JSON.stringify(message));
	});
}

function genericCommand() {
	
}


/*
 * Function to subscribe to all topics necessary for Shades to run.
 */
MQTT.prototype.subscribeShade = function(raspyID, ardID, devID) {
	let debug = require('./debug.js');
	let config = require('./config.js');
	let topicPrefix = config.mqtt.topicPrefix + '/' + raspyID + '/' + ardID + '/' + devID;
	let commandTopic = topicPrefix + '/direction-cmd';
	let setPositionTopic = topicPrefix + '/position-cmd';
	let tiltCommandTopic = topicPrefix + '/tilt-cmd';
	
	if (!config.mqtt.enabled) {
		debug.log(5, 'mqtt', 'Not subscribing to any topic due to disabled MQTT by configuration.');
		return;
	}
	
	if (typeof(this.MQTTDevices.raspys[raspyID]) == 'undefined') {
		this.MQTTDevices.raspys[raspyID] = {};
		this.MQTTDevices.raspys[raspyID].arduinos = {};
	}
	if (typeof(this.MQTTDevices.raspys[raspyID].arduinos[ardID]) == 'undefined') {
		this.MQTTDevices.raspys[raspyID].arduinos[ardID] = {};
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices = {};
	}
	if (typeof(this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID]) == 'undefined') {
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID] = {};
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics = {};
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[commandTopic] = {};
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[setPositionTopic] = {};
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[tiltCommandTopic] = {};
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[commandTopic].ignorePublish = true;
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[setPositionTopic].ignorePublish = true;
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[tiltCommandTopic].ignorePublish = true;
	}


	
	this.client.subscribe(commandTopic, {"rap": true}, function(error){
		if (error)
			debug.log(2, 'mqtt', 'Problem with subscribing to topic: ' + commandTopic + ' error: ' + error.toString());
		else
			debug.log(4, 'mqtt', 'Succesfully subscribed to topic: ' + commandTopic);
	});
	this.client.subscribe(setPositionTopic, {"rap": true}, function(error){
		if (error)
			debug.log(2, 'mqtt', 'Problem with subscribing to topic: ' + setPositionTopic + ' error: ' + error.toString());
		else
			debug.log(4, 'mqtt', 'Succesfully subscribed to topic: ' + setPositionTopic);
	});
	this.client.subscribe(tiltCommandTopic, {"rap": true}, function(error){
		if (error)
			debug.log(2, 'mqtt', 'Problem with subscribing to topic: ' + tiltCommandTopic + ' error: ' + error.toString());
		else
			debug.log(4, 'mqtt', 'Succesfully subscribed to topic: ' + tiltCommandTopic);
	});
}


MQTT.prototype.publishShadeOnline = function(raspyID, ardID, devID) {
	let debug = require('./debug.js');
	let config = require('./config.js');
	let topicPrefix = config.mqtt.topicPrefix + '/' + raspyID + '/' + ardID + '/' + devID;
	let availabilityTopic = topicPrefix + '/availability';
	let options = { 
		qos: 2, 
		retain: true };
	
	if (!config.mqtt.enabled) {
		debug.log(5, 'mqtt', 'Not subscribing to any topic due to disabled MQTT by configuration.');
		return;
	}
	
	debug.log(4, 'mqtt', 'Publishing payload: online to availabilityTopic: ' + availabilityTopic);
	this.client.publish(availabilityTopic, 'online', options);
}

MQTT.prototype.publishShadeOffline = function(raspyID, ardID, devID) {
	let debug = require('./debug.js');
	let config = require('./config.js');
	let topicPrefix = config.mqtt.topicPrefix + '/' + raspyID + '/' + ardID + '/' + devID;
	let availabilityTopic = topicPrefix + '/availability';
	let options = { 
		qos: 2, 
		retain: true };
		
	if (!config.mqtt.enabled) {
		debug.log(5, 'mqtt', 'Not subscribing to any topic due to disabled MQTT by configuration.');
		return;
	}
	
	debug.log(4, 'mqtt', 'Publishing payload: offline to availabilityTopic: ' + availabilityTopic);
	this.client.publish(availabilityTopic, 'offline', options);
}

MQTT.prototype.publishShadePosition = function(raspyID, ardID, devID, position) {
	let debug = require('./debug.js');
	let config = require('./config.js');
	let topicPrefix = config.mqtt.topicPrefix + '/' + raspyID + '/' + ardID + '/' + devID;
	let positionTopic = topicPrefix + '/position-status';
	let options = { 
		qos: 2, 
		retain: true };
	
	/* reversing the percentage order for HA */
	let newPosition;
	if (position == 0)
		newPosition = '100';
	if (position == 25)
		newPosition = '75';
	if (position == 50)
		newPosition = '50';
	if (position == 75)
		newPosition = '25';
	if (position == 100)
		newPosition = '0';
	
	if (!config.mqtt.enabled) {
		debug.log(5, 'mqtt', 'Not publishing to any topic due to disabled MQTT by configuration.');
		return;
	}
	
	debug.log(4, 'mqtt', 'Publishing payload: ' + newPosition + ' to positionTopic: ' + positionTopic);
	this.client.publish(positionTopic, newPosition, options);
}

MQTT.prototype.publishShadeTilt = function(raspyID, ardID, devID, tilt) {
	let debug = require('./debug.js');
	let config = require('./config.js');
	let topicPrefix = config.mqtt.topicPrefix + '/' + raspyID + '/' + ardID + '/' + devID;
	let tiltStatusTopic = topicPrefix + '/tilt-status';
	let options = { 
		qos: 2, 
		retain: true };
	
	if (!config.mqtt.enabled) {
		debug.log(5, 'mqtt', 'Not subscribing to any topic due to disabled MQTT by configuration.');
		return;
	}
	
	debug.log(4, 'mqtt', 'Publishing payload: ' + tilt + ' to tiltStatusTopic: ' + tiltStatusTopic);
	this.client.publish(tiltStatusTopic, tilt, options);
}



module.exports = mqtt;