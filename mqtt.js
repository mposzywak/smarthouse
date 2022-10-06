


let MQTT = function() {
	let config = require('./config.js');
	let mqtt = this;
	this.mqtt = require('mqtt');
	this.connected = false;
	let conn = this.connected;
	debug = require('./debug.js');
	this.components = require('./components').setFacility(this, 'mqtt');
	let firstConnect = true;
	if (config.mqtt.enabled) {
		let options = {
			will: {
				topic: config.mqtt.topicPrefix + '/raspy-status',
				payload: 'OFF',
				qos: 2,
				retain: true
			}
		};
		this.MQTTDevices = {};
		this.MQTTDevices.raspys = {}
		this.client = this.mqtt.connect(config.mqtt.broker, options);
		let c = this.client;
		
		this.client.on('connect', function() {
			let statusTopic = config.mqtt.topicPrefix + '/status';
			debug.log(4, 'mqtt', 'Connected succesfully to MQTT broker: ' + config.mqtt.broker);
			mqtt.connected = true;
			c.subscribe(statusTopic, {"rap": true}, function(error){
				if (error)
					debug.log(2, 'mqtt', 'Problem with subscribing to topic: ' + statusTopic + ' error: ' + error.toString());
				else
					debug.log(4, 'mqtt', 'Succesfully subscribed to topic: ' + statusTopic);
			});

			/* sending all device sttus upon connection restablishment*/
			if (firstConnect == false) {
				publishAllDevices();
				setTimeout(function() {
					publishAllDevicesStateOffline();
				}, 15000);
				setTimeout(function() {
					publishAllDevicesState();
				}, 20000);
			}
			firstConnect = false;
		});
		this.client.on('error', function(error) {	
			debug.log(1, 'mqtt', 'Problem connecting with MQTT broker: ' + error.toString());
		});
		this.client.on('message', function(topic, payload){
			debug.log(4, 'mqtt', 'Message received: ' + payload + ' from topic: ' + topic);
			console.log(" -- MQTT -- BFPDevice command payload: " + payload)
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
			} else if (cmd == 'switch-cmd') {
				switchCommand(topic, payload);
			} else {
				debug.log(1, 'mqtt', 'Unknown CMD received: ' + cmd);
			}
		});
		this.client.on('error', function(error){
			debug.log(1, 'mqtt', 'Unknown Error received: ' + error.toString());
		});
		this.client.on('disconnect', function(){
			debug.log(1, 'mqtt', 'Disconnect packet received from the broker.');
			mqtt.connected = false;
		});
		this.client.on('offline', function(){
			debug.log(1, 'mqtt', 'Broker goes offline.');
			setAllDevicesToIgnore();
			mqtt.connected = false;
		});
		
		setInterval(function(){
			if (require('./mqtt.js').connected == true) {
				debug.log(5, 'mqtt', 'Publishing raspy-status ON/online')
				c.publish(config.mqtt.topicPrefix + '/raspy-status', 'ON');
				c.publish(config.mqtt.topicPrefix + '/raspy-status/availability', 'online');
			}
		}, 30000);
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
	/* commenting it out as it looks like it is not necessary feature */
	let savedTopic = require('./mqtt.js').MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[topic];
	
	if (typeof(savedTopic) != 'undefined') {
		if (require('./mqtt.js').MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[topic].ignoreFirstPublish == true) {
			debug.log(5, 'mqtt', 'Ignoring this MQTT message as it is first after connectivity established with Home Assistant.');
			require('./mqtt.js').MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[topic].ignoreFirstPublish = false;
			return;
		}
		let BFPDeviceCommand = bfp.BFPCreateDeviceCommandShade(device, null, payload);
		BFPDeviceCommand.body.IP = device.IP;
		arif.sendCommand(BFPDeviceCommand.body, BFPDeviceCommand.header.command, function(message) {
	
		});
	}
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
	/* commenting it out as it looks like it is not necessary feature */
	let savedTopic = require('./mqtt.js').MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[topic];
	
	if (typeof(savedTopic) != 'undefined') {
		if (require('./mqtt.js').MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[topic].ignoreFirstPublish == true) {
			debug.log(5, 'mqtt', 'Ignoring this MQTT message as it is first after connectivity established with Home Assistant.');
			require('./mqtt.js').MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[topic].ignoreFirstPublish = false;
			return;
		}
		let BFPDeviceCommand = bfp.BFPCreateDeviceCommandShade(device, payload, 'shadePOS');
		
		BFPDeviceCommand.body.IP = device.IP;
		arif.sendCommand(BFPDeviceCommand.body, BFPDeviceCommand.header.command, function(message) {

		});
	}
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
	/* commenting it out as it looks like it is not necessary feature */
	let savedTopic = require('./mqtt.js').MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[topic];
	
	if (typeof(savedTopic) != 'undefined') {
		if (require('./mqtt.js').MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[topic].ignoreFirstPublish == true) {
			debug.log(5, 'mqtt', 'Ignoring this MQTT message as it is first after connectivity established with Home Assistant.');
			require('./mqtt.js').MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[topic].ignoreFirstPublish = false;
			return;
		}
		let newValue;
		if (payload <= 30)
			newValue = 90;
		else if (payload > 30 && payload <= 70)
			newValue = 45;
		else if (payload > 70) 
			newValue = 0;
	
		let BFPDeviceCommand = bfp.BFPCreateDeviceCommandShade(device, newValue, 'shadeTILT');
	
		BFPDeviceCommand.body.IP = device.IP;
		arif.sendCommand(BFPDeviceCommand.body, BFPDeviceCommand.header.command, function(message) {

		});
	}
}

function switchCommand(topic, payload) {
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
	/* commenting it out as it looks like it is not necessary feature */
	/*if (require('./mqtt.js').MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[topic].ignoreFirstPublish == true) {
		debug.log(5, 'mqtt', 'Ignoring this MQTT message as it is first after connectivity established with Home Assistant.');
		require('./mqtt.js').MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[topic].ignoreFirstPublish = false;
		return;
	}*/
	
	if (payload == 'ON') {
		arif.sendCommand(device, 'lightON', function(message) {
			//debug.log(5, 'mqtt', 'Received response from ARiF: ' + JSON.stringify(message));
		});
	} else if (payload == 'OFF') {
		arif.sendCommand(device, 'lightOFF', function(message) {
			//debug.log(5, 'mqtt', 'Received response from ARiF: ' + JSON.stringify(message));
		});
	} else {
		debug.log(5, 'mqtt', 'Unrecognized payload received: ' + payload + ' on topic: ' + topic);
	}
}

function publishAllDevices() {
	let config = require('./config.js');
	let mem = require('./mem.js');
	let debug = require('./debug.js');
	let mqtt = require('./mqtt.js');
	
	devices = mem.getClientDevices(config.cloud.id);
	
	for (var raspyID in devices.raspys) {
		if (raspyID > 0 && raspyID < 999) { // control if variable is actually a raspyID or meta
			for (var ardID in devices.raspys[raspyID].arduinos) {
				if (ardID > 0 && ardID < 256) {
					for (var devID in devices.raspys[raspyID].arduinos[ardID].devices) {
						if (devID > 0 && devID < 256) {
							//debug.log(5, 'mqtt', 'Publishing over MQTT device data of raspyID: ' + raspyID + ' ardID: ' + ardID + ' devID: ' + devID);
							if (devices.raspys[raspyID].arduinos[ardID].devices[devID].devType == 'shade') {
								if (devices.raspys[raspyID].arduinos[ardID].devices[devID].alive == true) {
									let position = devices.raspys[raspyID].arduinos[ardID].devices[devID].position;
									let tilt = devices.raspys[raspyID].arduinos[ardID].devices[devID].tilt;
									mqtt.publishDeviceOnline(raspyID, ardID, devID);
									mqtt.publishShadePosition(raspyID, ardID, devID, position);
									mqtt.publishShadeTilt(raspyID, ardID, devID, tilt);
								} else {
									mqtt.publishShadeOffline(raspyID, ardID, devID);
								}
							} else if (devices.raspys[raspyID].arduinos[ardID].devices[devID].devType == 'digitOUT') {
								if (devices.raspys[raspyID].arduinos[ardID].devices[devID].alive == true) {
									let status = devices.raspys[raspyID].arduinos[ardID].devices[devID].value;
									mqtt.publishLightStatus(raspyID, ardID, devID, status);
								} else {
									mqtt.publishShadeOffline(raspyID, ardID, devID);
								}
							}
						}
					}
				}
			}
		}
	}
}

function publishAllDevicesState() {
	let config = require('./config.js');
	let mem = require('./mem.js');
	let debug = require('./debug.js');
	let mqtt = require('./mqtt.js');
	
	devices = mem.getClientDevices(config.cloud.id);
	
	debug.log(5, 'mqtt', 'Publishing over MQTT all Devices State');
	for (var raspyID in devices.raspys) {
		if (raspyID > 0 && raspyID < 999) { // control if variable is actually a raspyID or meta
			for (var ardID in devices.raspys[raspyID].arduinos) {
				if (ardID > 0 && ardID < 256) {
					for (var devID in devices.raspys[raspyID].arduinos[ardID].devices) {
						if (devID > 0 && devID < 256) {
							if (devices.raspys[raspyID].arduinos[ardID].devices[devID].alive == true) {
								mqtt.publishDeviceOnline(raspyID, ardID, devID);
							} else {
								mqtt.publishShadeOffline(raspyID, ardID, devID);
							}
						}
					}
				}
			}
		}
	}
}

function publishAllDevicesStateOffline() {
	let config = require('./config.js');
	let mem = require('./mem.js');
	let debug = require('./debug.js');
	let mqtt = require('./mqtt.js');
	
	devices = mem.getClientDevices(config.cloud.id);
	
	debug.log(5, 'mqtt', 'Publishing over MQTT all Devices as Offline');
	for (var raspyID in devices.raspys) {
		if (raspyID > 0 && raspyID < 999) { // control if variable is actually a raspyID or meta
			for (var ardID in devices.raspys[raspyID].arduinos) {
				if (ardID > 0 && ardID < 256) {
					for (var devID in devices.raspys[raspyID].arduinos[ardID].devices) {
						if (devID > 0 && devID < 256) {
							mqtt.publishDeviceOffline(raspyID, ardID, devID);
						}
					}
				}
			}
		}
	}
}


function setAllDevicesToIgnore() {
	let mqtt = require('./mqtt.js');
	let config = require('./config.js');
	let debug = require('./debug.js')
	let topicPrefix;
	let commandTopic;
	let setPositionTopic;
	let tiltCommandTopic;
	
	for (var raspyID in mqtt.MQTTDevices.raspys) {
		for (var ardID in mqtt.MQTTDevices.raspys[raspyID].arduinos) {
			for (var devID in mqtt.MQTTDevices.raspys[raspyID].arduinos[ardID].devices) {
				topicPrefix = config.mqtt.topicPrefix + '/' + raspyID + '/' + ardID + '/' + devID;
				if (mqtt.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].devType == 'shade') {
					commandTopic = topicPrefix + '/direction-cmd';
					setPositionTopic = topicPrefix + '/position-cmd';
					tiltCommandTopic = topicPrefix + '/tilt-cmd';
					mqtt.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[commandTopic].ignoreFirstPublish = true;
					mqtt.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[setPositionTopic].ignoreFirstPublish = true;
					mqtt.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[tiltCommandTopic].ignoreFirstPublish = true;
				} else if (mqtt.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].devType == 'digitOUT') {
					statusTopic = topicPrefix + '/switch-cmd';
					mqtt.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[statusTopic].ignoreFirstPublish = true;
				}
				debug.log(5, 'mqtt', 'Setting raspyID: ' + raspyID + ' ardID: ' + ardID + ' devID: ' + devID + ' to ignore first incoming MQTT message.')
			}
		}
	}
}

/*
 * Function to subscribe to all topics necessary for Lights to run.
 */

MQTT.prototype.subscribeLight = function(raspyID, ardID, devID) {
	let debug = require('./debug.js');
	let config = require('./config.js');
	let topicPrefix = config.mqtt.topicPrefix + '/' + raspyID + '/' + ardID + '/' + devID;
	let commandTopic = topicPrefix + '/switch-cmd';
	
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
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].devType = 'digitOUT';
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics = {};
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[commandTopic] = {};
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[commandTopic].ignoreFirstPublish = true;
	} else if (this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].devType != 'digitOUT') {
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].devType = 'digitOUT';
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[commandTopic] = {};
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[commandTopic].ignoreFirstPublish = true;
	} else {
		debug.log(5, 'mqtt', 'Device: ' + devID + ', ardID: ' + ardID + ', topic: ' + commandTopic + ' already subscribed. Doing nothing.');
		return;
	}
	
	this.client.subscribe(commandTopic, {"rap": true}, function(error){
		if (error)
			debug.log(2, 'mqtt', 'Problem with subscribing to topic: ' + commandTopic + ' error: ' + error.toString());
		else
			debug.log(4, 'mqtt', 'Succesfully subscribed to topic: ' + commandTopic);
	});
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
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].devType = 'shade';
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics = {};
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[commandTopic] = {};
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[setPositionTopic] = {};
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[tiltCommandTopic] = {};
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[commandTopic].ignoreFirstPublish = true;
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[setPositionTopic].ignoreFirstPublish = true;
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[tiltCommandTopic].ignoreFirstPublish = true;
	} else if (this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].devType != 'shade') {
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].devType = 'shade';
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[commandTopic] = {};
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[setPositionTopic] = {};
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[tiltCommandTopic] = {};
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[commandTopic].ignoreFirstPublish = true;
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[setPositionTopic].ignoreFirstPublish = true;
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[tiltCommandTopic].ignoreFirstPublish = true;
	} else {
		debug.log(5, 'mqtt', 'Device: ' + devID + ', ardID: ' + ardID + ', shade topics already subscribed. Doing nothing.');
		return;
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
	
	var commandTopicIgnoreFirstPublish = this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[commandTopic].ignoreFirstPublish;
	var positionTopicIgnoreFirstPublish = this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[setPositionTopic].ignoreFirstPublish;
	var tiltCommandTopicIgnoreFirstPublish = this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[tiltCommandTopic].ignoreFirstPublish;
	
	setTimeout(function() {
		commandTopicIgnoreFirstPublish = false;
		positionTopicIgnoreFirstPublish = false;
		tiltCommandTopicIgnoreFirstPublish = false;
	}, 3000)
}



/*
 * Function to subscribe to all topics necessary for Shades to run.
 */
MQTT.prototype.subscribeTemp = function(raspyID, ardID, devID) {
	let debug = require('./debug.js');
	let config = require('./config.js');
	let topicPrefix = config.mqtt.topicPrefix + '/' + raspyID + '/' + ardID + '/' + devID;
	let statusTopic = topicPrefix + '/temp-status';
	
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
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].devType = 'temp';
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics = {};
		this.MQTTDevices.raspys[raspyID].arduinos[ardID].devices[devID].topics[statusTopic] = {};
	}


	
	this.client.subscribe(statusTopic, {"rap": true}, function(error){
		if (error)
			debug.log(2, 'mqtt', 'Problem with subscribing to topic: ' + statusTopic + ' error: ' + error.toString());
		else
			debug.log(4, 'mqtt', 'Succesfully subscribed to topic: ' + statusTopic);
	});
}

/**
 * Publish the arduino binary_sensor configuration to HA 
 */
MQTT.prototype.configureArduino = function(raspyID, ardID, name) {
	let debug = require('./debug.js');
	let config = require('./config.js');
	let topicPrefix = config.mqtt.topicPrefix;
	let options = { 
		qos: 2, 
		retain: true 
	};
	let configString = '{"name": "' + name + '", "unique_id": "binary_sensor.arduino-' + ardID + '", \
						"state_topic": "velen-mqtt/001/' + ardID + '/arduino-status", "payload_on": "ON", \
						"payload_off": "OFF", "availability_topic": "velen-mqtt/001/' + ardID + '/arduino-availability", \
						"payload_available": "online", "payload_not_available": "offline", "qos": 0, "device_class": "connectivity"}';
	
	let discoveryTopic = 'velen-discovery/binary_sensor/arduino-' + ardID + '/config';
	
	debug.log(4, 'mqtt', 'Publishing Arduino binary_sensor configuration, ardID: '+ ardID + ' to HA: ' + configString + ', onto topic: ' + discoveryTopic);
	this.client.publish(discoveryTopic, configString, options);
}

/**
 * Publish empty string to remove the configure arduino binary_sensor to HA
 */
MQTT.prototype.removeArduino = function(raspyID, ardID) {
	let debug = require('./debug.js');
	let config = require('./config.js');
	let topicPrefix = config.mqtt.topicPrefix;
	let options = { 
		qos: 2, 
		retain: true 
	};
	let discoveryTopic = 'velen-discovery/binary_sensor/arduino-' + ardID + '/config';
	let configString = ''
	debug.log(4, 'mqtt', 'Removing arduino binary_sensor configuration of ardID: ' + ardID);
	this.client.publish(discoveryTopic, configString, options);
}

/**
 * Rename the binary_sensor arduino from the HA config
 */
MQTT.prototype.renameArduino = function(raspyID, ardID, name) {
	this.removeArduino(raspyID, ardID);
	this.configureArduino(raspyID, ardID, name);
}

/**
 * Send MQTT based temperature sensor configuration to HA
 */
MQTT.prototype.configureTemp = function(raspyID, ardID, devID, name) {
	let debug = require('./debug.js');
	let config = require('./config.js');
	let topicPrefix = config.mqtt.topicPrefix;
	let options = { 
		qos: 2, 
		retain: true 
	};
	let configString;
	let discoveryString;
	
	configString = '{"name": "' + name + '", "state_topic": "velen-mqtt/001/' + ardID + '/' + devID + '/temp-status", \
					"availability_topic": "velen-mqtt/001/' + ardID + '/' + devID + '/availability", \
					"unit_of_measurement": "°C", "device_class": "temperature", \
					"unique_id": "sensor.temp-' + ardID + '-' + devID + '"}';
	discoveryTopic = 'velen-discovery/sensor/arduino-' + ardID + '-temp-' + devID + '/config';
	
	debug.log(4, 'mqtt', 'Publishing Temp sensor configuration, ardID: '+ ardID + ', devID: ' + devID + ' to HA: ' + configString + ', onto topic: ' + discoveryTopic);
	this.client.publish(discoveryTopic, configString, options);
}

/**
 * remove MQTT based temperature sensor configuration from HA
 */
MQTT.prototype.removeTemp = function(raspyID, ardID, devID) {
	let debug = require('./debug.js');
	let config = require('./config.js');
	let topicPrefix = config.mqtt.topicPrefix;
	let options = { 
		qos: 2, 
		retain: true 
	};
	let discoveryTopic;
	let configString = ''
	
	discoveryTopic = 'velen-discovery/sensor/arduino-' + ardID + '-temp-' + devID + '/config';
	debug.log(4, 'mqtt', 'Removing Temp sensor configuration of ardID: ' + ardID + ', devID: ' + devID);
	this.client.publish(discoveryTopic, configString, options);	
}

/**
 * Send MQTT based light configuration to HA
 */
MQTT.prototype.configureLight = function(raspyID, ardID, devID, name, extType) {
	let debug = require('./debug.js');
	let config = require('./config.js');
	let topicPrefix = config.mqtt.topicPrefix;
	let options = { 
		qos: 2, 
		retain: true 
	};
	let configString;
	let discoveryString;
	
	if (extType == 0) {
		configString = '{"name": "' + name + '", "state_topic": "velen-mqtt/001/' + ardID + '/' + devID + '/status", \
	 					"command_topic": "velen-mqtt/001/' + ardID + '/' + devID + '/switch-cmd", \
						"availability_topic": "velen-mqtt/001/' + ardID + '/' + devID + '/availability", \
						"qos": 0, "payload_on": "ON", "payload_off": "OFF", "state_on": "ON", "state_off": "OFF", \
						"optimistic": "false", "unique_id": "light.velen-' + ardID + '-' + devID + '"}';
		discoveryTopic = 'velen-discovery/light/arduino-' + ardID + '-light-' + devID + '/config';
	
		debug.log(4, 'mqtt', 'Publishing Light configuration, ardID: '+ ardID + ', devID: ' + devID + ' to HA: ' + configString + ', onto topic: ' + discoveryTopic);
		this.client.publish(discoveryTopic, configString, options);
	} else if (extType == 1) {
		configString = '{"name": "' + name + '", "state_topic": "velen-mqtt/001/' + ardID + '/' + devID + '/status", \
				"availability_topic": "velen-mqtt/001/' + ardID + '/' + devID + '/availability", \
				"qos": 0, "payload_on": "ON", "payload_off": "OFF", "state_on": "ON", "state_off": "OFF", \
				"optimistic": "false", "unique_id": "binary_sensor.sensor-' + ardID + '-' + devID + '"}';
		discoveryTopic = 'velen-discovery/binary_sensor/arduino-' + ardID + '-binary-sensor-' + devID + '/config';
		
		debug.log(4, 'mqtt', 'Publishing Normal Binary Sensor configuration, ardID: '+ ardID + ', devID: ' + devID + ' to HA: ' + configString + ', onto topic: ' + discoveryTopic);
		this.client.publish(discoveryTopic, configString, options);
	} else if (extType == 2) {
		configString = '{"name": "' + name + '", "state_topic": "velen-mqtt/001/' + ardID + '/' + devID + '/status", \
						"availability_topic": "velen-mqtt/001/' + ardID + '/' + devID + '/availability", \
						"qos": 0, "payload_on": "OFF", "payload_off": "ON", "state_on": "OFF", "state_off": "ON", \
						"optimistic": "false", "unique_id": "binary_sensor.sensor-' + ardID + '-' + devID + '"}';
		discoveryTopic = 'velen-discovery/binary_sensor/arduino-' + ardID + '-binary-sensor-' + devID + '/config';

		debug.log(4, 'mqtt', 'Publishing Reversed Binary Sensor configuration, ardID: '+ ardID + ', devID: ' + devID + ' to HA: ' + configString + ', onto topic: ' + discoveryTopic);
		this.client.publish(discoveryTopic, configString, options);
	} else {
		debug.log(1, 'mqtt', 'Something went wrong when publishing MQTT configuration, wrong extType: ' + extType);
	}
}

MQTT.prototype.removeLight = function(raspyID, ardID, devID, extType) {
	let debug = require('./debug.js');
	let config = require('./config.js');
	let topicPrefix = config.mqtt.topicPrefix;
	let options = { 
		qos: 2, 
		retain: true 
	};
	let discoveryTopic;
	let configString = ''
	
	if (extType == 0) {
		discoveryTopic = 'velen-discovery/light/arduino-' + ardID + '-light-' + devID + '/config';
		debug.log(4, 'mqtt', 'Removing Light configuration of ardID: ' + ardID + ', devID: ' + devID);
		this.client.publish(discoveryTopic, configString, options);
	} else if (extType == 1 || extType == 2) {
		discoveryTopic = 'velen-discovery/binary_sensor/arduino-' + ardID + '-binary-sensor-' + devID + '/config';
		debug.log(4, 'mqtt', 'Removing Binary Sensor configuration of ardID: ' + ardID + ', devID: ' + devID);
		this.client.publish(discoveryTopic, configString, options);
	} else {
		debug.log(1, 'mqtt', 'Something went wrong when removing MQTT configuration, wrong extType: ' + extType);
	}
	
}

MQTT.prototype.renameLight = function(raspyID, ardID, devID, name) {
	this.removeLight(raspyID, ardID, devID);
	this.configureLight(raspyID, ardID, devID, name);
}

/**
 * Send MQTT based shade configuration to HA
 */
MQTT.prototype.configureShade = function(raspyID, ardID, devID, name) {
	let debug = require('./debug.js');
	let config = require('./config.js');
	let topicPrefix = config.mqtt.topicPrefix;
	let options = { 
		qos: 2, 
		retain: true 
	};
	
	let configString = '{"name": "' + name + '", \
	"unique_id": "cover.velen-' + ardID + '-' + devID + '", \
	"command_topic": "velen-mqtt/001/' + ardID + '/' + devID + '/direction-cmd", \
	"availability_topic": "velen-mqtt/001/' + ardID + '/' + devID + '/availability", \
	"set_position_topic": "velen-mqtt/001/' + ardID + '/' + devID + '/position-cmd", \
	"position_topic": "velen-mqtt/001/' + ardID + '/' + devID + '/position-status",  \
	"tilt_command_topic": "velen-mqtt/001/' + ardID + '/' + devID + '/tilt-cmd",  \
	"tilt_status_topic": "velen-mqtt/001/' + ardID + '/' + devID + '/tilt-status", \
	"qos": 0, \
	"payload_open": "OPEN", \
	"payload_close": "CLOSE", \
	"payload_stop": "STOP", \
	"position_open": 100, \
	"position_closed": 0, \
	"optimistic": false, \
	"retain": true, \
	"payload_available": "online", \
	"payload_not_available": "offline", \
	"set_position_template": "{% if position < 10 %} 100 {% elif position > 10 and position <= 35 %} 75 {% elif position > 35 and position <= 65 %} 50 {% elif position > 65 and position <= 90 %} 25 {% else %} 0 {% endif %}", \
	"tilt_min": 0, \
	"tilt_max": 100, \
	"tilt_closed_value": 0, \
	"tilt_opened_value": 100}';
	
	let discoveryTopic = 'velen-discovery/cover/arduino-' + ardID + '-cover-' + devID + '/config';
	
	debug.log(4, 'mqtt', 'Publishing Shade configuration, ardID: '+ ardID + ', devID: ' + devID + ' to HA: ' + configString + ', onto topic: ' + discoveryTopic);
	this.client.publish(discoveryTopic, configString, options);
	
}

MQTT.prototype.removeShade = function(raspyID, ardID, devID) {
	let debug = require('./debug.js');
	let config = require('./config.js');
	let topicPrefix = config.mqtt.topicPrefix;
	let options = { 
		qos: 2, 
		retain: true 
	};
	let discoveryTopic = 'velen-discovery/cover/arduino-' + ardID + '-cover-' + devID + '/config';
	let configString = ''

	debug.log(4, 'mqtt', 'Removing Shade configuration of ardID: ' + ardID + ', devID: ' + devID);
	this.client.publish(discoveryTopic, configString, options);
}

MQTT.prototype.changeNameShade = function(raspyID, ardID, devID, name) {
	this.removeShade(raspyID, ardID, devID);
	this.configureShade(raspyID, ardID, devID, name);
}

MQTT.prototype.publishArduinoOnline = function(raspyID, ardID) {
	let debug = require('./debug.js');
	let config = require('./config.js');
	let topicPrefix = config.mqtt.topicPrefix + '/' + raspyID + '/' + ardID;
	let statusTopic = topicPrefix + '/arduino-status';
	let availabilityTopic = topicPrefix + '/arduino-availability';
	let options = { 
		qos: 2, 
		retain: true 
	};
	
	if (!config.mqtt.enabled) {
		debug.log(5, 'mqtt', 'Not subscribing to any topic due to disabled MQTT by configuration.');
		return;
	}
	
	debug.log(4, 'mqtt', 'Publishing payload: Arduino ON to status topic: ' + availabilityTopic);
	this.client.publish(availabilityTopic, 'online', options);
	this.client.publish(statusTopic, 'ON', options);
}

MQTT.prototype.publishArduinoOffline = function(raspyID, ardID) {
	let debug = require('./debug.js');
	let config = require('./config.js');
	let topicPrefix = config.mqtt.topicPrefix + '/' + raspyID + '/' + ardID;
	let statusTopic = topicPrefix + '/arduino-status';
	let availabilityTopic = topicPrefix + '/arduino-availability';
	
	let options = { 
		qos: 2, 
		retain: true 
	};
	
	if (!config.mqtt.enabled) {
		debug.log(5, 'mqtt', 'Not subscribing to any topic due to disabled MQTT by configuration.');
		return;
	}
	
	debug.log(4, 'mqtt', 'Publishing payload: Arduino OFF to status topic: ' + availabilityTopic);
	this.client.publish(availabilityTopic, 'online', options);
	this.client.publish(statusTopic, 'OFF', options);
}

MQTT.prototype.publishDeviceOnline = function(raspyID, ardID, devID) {
	let debug = require('./debug.js');
	let config = require('./config.js');
	let topicPrefix = config.mqtt.topicPrefix + '/' + raspyID + '/' + ardID + '/' + devID;
	let availabilityTopic = topicPrefix + '/availability';
	
	let options = { 
		qos: 2, 
		retain: true 
	};
	
	if (!config.mqtt.enabled) {
		debug.log(5, 'mqtt', 'Not subscribing to any topic due to disabled MQTT by configuration.');
		return;
	}
	
	debug.log(4, 'mqtt', 'Publishing payload: Device online to availabilityTopic: ' + availabilityTopic);
	this.client.publish(availabilityTopic, 'online', options);
}

MQTT.prototype.publishDeviceOffline = function(raspyID, ardID, devID) {
	let debug = require('./debug.js');
	let config = require('./config.js');
	let topicPrefix = config.mqtt.topicPrefix + '/' + raspyID + '/' + ardID + '/' + devID;
	let availabilityTopic = topicPrefix + '/availability';
	let options = { 
		qos: 2, 
		retain: true 
	};
		
	if (!config.mqtt.enabled) {
		debug.log(5, 'mqtt', 'Not subscribing to any topic due to disabled MQTT by configuration.');
		return;
	}
	
	debug.log(4, 'mqtt', 'Publishing payload: Device offline to availabilityTopic: ' + availabilityTopic);
	this.client.publish(availabilityTopic, 'offline', options);
}

MQTT.prototype.publishShadePosition = function(raspyID, ardID, devID, position) {
	let debug = require('./debug.js');
	let config = require('./config.js');
	let topicPrefix = config.mqtt.topicPrefix + '/' + raspyID + '/' + ardID + '/' + devID;
	let positionTopic = topicPrefix + '/position-status';
	let options = { 
		qos: 2, 
		retain: true 
	};
	
	/* reversing the percentage order for HA */
	let newPosition;
	if (position == 0)
		newPosition = '100';
	else if (position == 25)
		newPosition = '75';
	else if (position == 50)
		newPosition = '50';
	else if (position == 75)
		newPosition = '25';
	else if (position == 100)
		newPosition = '0';
	else {
		debug.log(4, 'mqtt', 'Incorrect value of position: ' + position + ', not publishing anything.');
		return;
	}
	
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
		retain: true 
	};
	let newTilt;
	
	if (tilt == 0)
		newTilt = '100';
	else if (tilt == 45)
		newTilt = '50';
	else if (tilt == 90)
		newTilt = '0';
	else {
		debug.log(4, 'mqtt', 'Incorrect value of tilt: ' + tilt + ', not publishing anything.');
		return;
	}
	
	if (!config.mqtt.enabled) {
		debug.log(4, 'mqtt', 'Not publishing due to disabled MQTT by configuration.');
		return;
	}
	
	debug.log(4, 'mqtt', 'Publishing payload: ' + newTilt + ' to tiltStatusTopic: ' + tiltStatusTopic);
	this.client.publish(tiltStatusTopic, newTilt, options);
}

MQTT.prototype.publishLightStatus = function(raspyID, ardID, devID, status) {
	let debug = require('./debug.js');
	let config = require('./config.js');
	let topicPrefix = config.mqtt.topicPrefix + '/' + raspyID + '/' + ardID + '/' + devID;
	let statusTopic = topicPrefix + '/status';
	let options = { 
		qos: 2, 
		retain: true 
	};
	
	if (!config.mqtt.enabled) {
		debug.log(4, 'mqtt', 'Not publishing due to disabled MQTT by configuration.');
		return;
	}
	
	if (status == 0) {
		debug.log(4, 'mqtt', 'Publishing payload: OFF to light/sensor status topic: ' + statusTopic);
		this.client.publish(statusTopic, 'OFF', options);
	} else if (status == 1) {
		debug.log(4, 'mqtt', 'Publishing payload: ON to light/sensor status topic: ' + statusTopic);
		this.client.publish(statusTopic, 'ON', options);
	} else {
		debug.log(1, 'mqtt', 'Incorrect status value on: ' + statusTopic + ', status: ' + status);
	}
}

MQTT.prototype.publishTempStatus = function(raspyID, ardID, devID, status) {
	let debug = require('./debug.js');
	let config = require('./config.js');
	let topicPrefix = config.mqtt.topicPrefix + '/' + raspyID + '/' + ardID + '/' + devID;
	let statusTopic = topicPrefix + '/temp-status';
	let options = { 
		qos: 2, 
		retain: true 
	};
	
	if (!config.mqtt.enabled) {
		debug.log(4, 'mqtt', 'Not publishing due to disabled MQTT by configuration.');
		return;
	}
		
	debug.log(4, 'mqtt', 'Publishing payload: ' + status + ' to temp status topic: ' + statusTopic);
	this.client.publish(statusTopic, status, options);

}

MQTT.prototype.isMQTTConnected = function() {
	return this.connected;
}



module.exports = mqtt;