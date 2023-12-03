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
		let mqtt = require('./mqtt.js');
		this.devices[this.accountID] = {};
		this.devices[this.accountID].raspys = {};
		this.devices[this.accountID].raspys[this.raspyID] = {};
		
		this.db.getAllAccountDevices(this.accountID, function(error, raspys) {
			if (error) {
				require('./debug.js').log(3, 'configdb', 'Failed to access configDB: ' + error.message);
			} else {
				devices[accountID].raspys = raspys;
				devices[accountID].raspys[raspyID].pending = {};
				require('./debug.js').log(3, 'configdb', 'ConfigDB contents loaded succesfully [Raspy mode]');
				for (var ardID in devices[accountID].raspys[raspyID].arduinos) {
					for (var devID in devices[accountID].raspys[raspyID].arduinos[ardID].devices) {
						if (devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID].devType == 'digitOUT') {
							mqtt.subscribeLight(raspyID, ardID, devID);
						} else if (devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID].devType == 'shade') {
							mqtt.subscribeShade(raspyID, ardID, devID);
						} else {
							require('./debug.js').log(1, 'mem', 'devID: ' + devID + ', ardID: ' + ardID + ' of unknown type!');
						}
					}
				}
				if (devices[accountID].raspys[raspyID].cloud) {
					// start VPN here:
					connectVPN();
				}
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
	var mqtt = require('./mqtt.js');
	// check if the accountID, device and arduino exists
	if (typeof(this.devices[accountID].raspys[this.raspyID].arduinos) == 'undefined') {
		var ardID; /* if entered this condition it means this is the first arduino, give it ID "1" */
		if (typeof(this.config.mem.minArdID) == 'undefined') {
			ardID = '2';
		} else {
			ardID = this.config.mem.minArdID;
		}
		this.devices[accountID].raspys[this.raspyID].arduinos = {};
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID] = {};
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices = {};
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].IP = IP; 
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].raspyID = this.raspyID;
		var desc = 'Arduino ' + ardID;
		this.devices[accountID].raspys[this.raspyID].arduinos[ardID].desc = desc;
		this.db.insertArduino(accountID, this.raspyID, IP, ardID, desc);
		this.components.getFacility('debug').log(4, 'mem', 'accountID id: ' + accountID + 
				', new Arduino registered: ' + ardID + ' from: ' + IP);
		
		mqtt.configureArduino(this.raspyID, ardID, 'Arduino ' + ardID);
		return ardID;
	} else { /* if at least one Arduino already registered (check by IP) */
	
		ardIDRegistered = this.isArduinoIPRegistered(accountID, IP);
		if (ardIDRegistered) {
			this.components.getFacility('debug').log(4, 'mem', 'accountID id: ' + accountID + 
				', Arduino from: ' + IP + ' registered already as: ' + ardIDRegistered);
			return ardIDRegistered;
		} else { /* new Arduino device (new IP) */
			if (typeof(this.config.mem.minArdID) == 'undefined') {
				ardID = '2';
			} else {
				ardID = this.config.mem.minArdID;
			}
			while (true) {
				if (typeof(this.devices[accountID].raspys[this.raspyID].arduinos[ardID]) == 'undefined') {
					
					this.devices[accountID].raspys[this.raspyID].arduinos[ardID] = {};
					this.devices[accountID].raspys[this.raspyID].arduinos[ardID].devices = {}
					this.devices[accountID].raspys[this.raspyID].arduinos[ardID].IP = IP;
					this.devices[accountID].raspys[this.raspyID].arduinos[ardID].raspyID = this.raspyID;
					var desc = 'Arduino ' + ardID;
					this.devices[accountID].raspys[this.raspyID].arduinos[ardID].desc = desc;
					this.db.insertArduino(accountID, this.raspyID, IP, ardID, desc);
					this.components.getFacility('debug').log(4, 'mem', 'accountID id: ' + accountID + 
							', new Arduino registered: ' + ardID + ' from: ' + IP);
							
					mqtt.configureArduino(this.raspyID, ardID, 'Arduino ' + ardID);
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
	var mqtt = require('./mqtt.js');
	var debug = require('./debug.js');
	arduino.ardID = ardID;
	arduino.raspyID = raspyID;
	for (var devID in arduinos[ardID].devices) {
		if (arduinos[ardID].devices[devID].activated == true){
			if (arduinos[ardID].devices[devID].devType == 'digitOUT') {
				mqtt.removeLight(raspyID, ardID, devID, arduinos[ardID].devices[devID].extType);
			} else if (arduinos[ardID].devices[devID].devType == 'shade') {
				mqtt.removeShade(raspyID, ardID, devID);
			} else if (arduinos[ardID].devices[devID].devType == 'temp') {
				mqtt.removeTemp(raspyID, ardID, devID);
			}
		}
	}
	mqtt.removeArduino(raspyID, ardID);
	debug.log(5, 'mem', 'ArdID and its devIDs removed: ' + ardID + ' on raspyID: ' + raspyID);
	delete arduinos[ardID];
	this.db.deleteArduino(accountID, arduino);
}

Mem.prototype.restoreArduino = function(accountID, raspyID, ardID) {
	var arif = require('./arif.js');
	var arduino = this.devices[accountID].raspys[raspyID].arduinos[ardID];
	var device = {};
	device.ardID = ardID;
	device.devID = 0;
	device.IP = arduino.IP;
	arif.sendCommand(device, 'restore', null);
}

/* the method puts the latest status into the mem cache 
	As an argument it takes BFPDeviceStatus object and accountID.
*/
Mem.prototype.setDeviceStatus = function(accountID, BFPDeviceStatus) {
	let isDeviceNew = false;
	let db = this.db;
	let device;
	let identityLog = 'For accountID id: ' + accountID + ', Arduino: "' + BFPDeviceStatus.body.ardID + '", Device: "' + BFPDeviceStatus.body.devID + '" ';
	let debug = this.components.getFacility('debug');
	let mqtt = require('./mqtt.js');
	/*if (!this.config.cloud.enabled)
		device = this.devices[accountID].raspys[this.raspyID].arduinos[BFPDeviceStatus.body.ardID].devices[BFPDeviceStatus.body.devID];
	else*/
	device = this.devices[accountID].raspys[BFPDeviceStatus.body.raspyID].arduinos[BFPDeviceStatus.body.ardID].devices[BFPDeviceStatus.body.devID];

	let userIndicaitonHeader = BFPDeviceStatus.header.user;
	
	debug.log(5, 'mem', identityLog + 'BFPDeviceStatus arrived at mem: ' + JSON.stringify(BFPDeviceStatus));

	/* generic settings for a new Device */
	if (typeof(device) == 'undefined') {
		var newDevice = {};
		newDevice.desc = '';
		newDevice.activated = false;
		newDevice.discovered = false;
		newDevice.IP = BFPDeviceStatus.body.IP;
		newDevice.devType = BFPDeviceStatus.body.devType;
		newDevice.raspyID = this.raspyID;
		newDevice.ardID = BFPDeviceStatus.body.ardID;
		newDevice.devID = BFPDeviceStatus.body.devID;
		if (BFPDeviceStatus.body.devType == 'digitOUT')
			newDevice.extType = 0;
		newDevice.alive = true;
		isDeviceNew = true;
		debug.log(4, 'mem', identityLog + 'New Device registered.');
		
		this.devices[accountID].raspys[BFPDeviceStatus.body.raspyID].arduinos[BFPDeviceStatus.body.ardID].devices[BFPDeviceStatus.body.devID] = newDevice;
		device = this.devices[accountID].raspys[BFPDeviceStatus.body.raspyID].arduinos[BFPDeviceStatus.body.ardID].devices[BFPDeviceStatus.body.devID];
		
		
		if (newDevice.devType == 'digitOUT') {
			newDevice.value = BFPDeviceStatus.body.value;
		}
	}

	if (device.activated == true) { 
		device.discovered = true;
	} else {
		device.discovered = false;
	}
	/* section with specific settings for different type of devices, currently: shades, digitOUT
	   This sections should contain handling for new and existing devices */
	if (BFPDeviceStatus.body.devType == 'digitOUT') { /* digitOUT (mostly lights) specific handling */
		mqtt.subscribeLight(BFPDeviceStatus.body.raspyID, BFPDeviceStatus.body.ardID, BFPDeviceStatus.body.devID);
		debug.log(5, 'mem', identityLog + 'DigitOUT device type received at mem.');
		device.dataType = BFPDeviceStatus.body.dataType;
		if (device.extType == 3) { /* power meter */
			if (isDeviceNew) {
				device.value = calculatekWh(device.timer, BFPDeviceStatus.body.value);
				this.db.insertDevice(accountID, device);
			} else {
				var oldValue = device.value;
				device.value = calculatekWh(device.timer, BFPDeviceStatus.body.value);
				device.date = BFPDeviceStatus.body.date;
				if (oldValue != device.value) {
					this.db.updateDevice(accountID, device);
				}
			}
		} else if (device.extType == 4) { /* water meter */
			
		} else { /* all other extTypes */
			if (isDeviceNew) {
				this.db.insertDevice(accountID, device);
			} else {
				var oldValue = device.value;
				device.value = BFPDeviceStatus.body.value;
				device.date = BFPDeviceStatus.body.date;
				if (oldValue != device.value) {
					this.db.updateDevice(accountID, device);
				}
			}
		}
	} else if (BFPDeviceStatus.body.devType == 'shade') { /* shades specific handling */
		mqtt.subscribeShade(BFPDeviceStatus.body.raspyID, BFPDeviceStatus.body.ardID, BFPDeviceStatus.body.devID);
		debug.log(5, 'mem', identityLog + 'Shade device type received at mem.');
		if (BFPDeviceStatus.body.dataType == 'direction') {
			device.direction = BFPDeviceStatus.body.value;
		} else if (BFPDeviceStatus.body.dataType == 'position') {
			device.position = BFPDeviceStatus.body.value;
			device.sync = true;
		} else if (BFPDeviceStatus.body.dataType == 'tilt') {
			device.tilt = BFPDeviceStatus.body.value;
		} else if (BFPDeviceStatus.body.dataType == 'sync') {
			if(BFPDeviceStatus.body.value == 0) {
				device.sync = false;
				delete device.position;
			} else if (BFPDeviceStatus.body.value == 1) {
				device.sync = true;
			} else {
				debug.log(2, 'mem', identityLog + 'Shade sync status incorrect value: ' + BFPDeviceStatus.body.value);
			}
		} else {
			debug.log(5, 'mem', identityLog + 'Shade device unknown dataType received: ' + BFPDeviceStatus.body.dataType);
		}
		if (isDeviceNew) {
			this.db.insertDevice(accountID, device);
		} else {
			this.db.updateDevice(accountID, device);
		}
	} else if (BFPDeviceStatus.body.devType == 'temp') { /* temp sensor specific handling */
		mqtt.subscribeTemp(BFPDeviceStatus.body.raspyID, BFPDeviceStatus.body.ardID, BFPDeviceStatus.body.devID);
		debug.log(5, 'mem', identityLog + 'Temperature sensor device type received at mem.');
		if (BFPDeviceStatus.body.dataType == 'float') {
			device.value = BFPDeviceStatus.body.value;
			device.dataType = 'float';
		}
		if (isDeviceNew) {
			this.db.insertDevice(accountID, device);
		} else {
			this.db.updateDevice(accountID, device);
		}
	} else if (BFPDeviceStatus.body.devType == 'humidity') { /* humidity sensor specific handling */
		debug.log(5, 'mem', identityLog + 'Humidity sensor device type received at mem.');
		if (BFPDeviceStatus.body.dataType == 'float') {
			device.value = BFPDeviceStatus.body.value;
			device.dataType = 'float';
		}
		if (isDeviceNew) {
			this.db.insertDevice(accountID, device);
		} else {
			this.db.updateDevice(accountID, device);
		}
	} else { /* unknown device handling */
		debug.log(2, 'mem', identityLog + 'Unknown device type received: ' + BFPDeviceStatus.body.devType);
		return;
	}
	

	/* always send the newest device */
	let newBFPDeviceStatus = require('./bfp.js').BFPCreateDeviceStatusFromMem(device);
	newBFPDeviceStatus.header.user = userIndicaitonHeader;
	onValueChange(accountID, newBFPDeviceStatus);

	/* also send to MQTT */
	mqtt.publishDeviceOnline(this.raspyID, BFPDeviceStatus.body.ardID, BFPDeviceStatus.body.devID);
	if (BFPDeviceStatus.body.dataType == 'position')
		mqtt.publishShadePosition(this.raspyID, BFPDeviceStatus.body.ardID, BFPDeviceStatus.body.devID, device.position);
	if (BFPDeviceStatus.body.dataType == 'tilt')
		mqtt.publishShadeTilt(this.raspyID, BFPDeviceStatus.body.ardID, BFPDeviceStatus.body.devID, device.tilt);
	if (BFPDeviceStatus.body.devType == 'digitOUT') {
		mqtt.publishLightStatus(this.raspyID, BFPDeviceStatus.body.ardID, BFPDeviceStatus.body.devID, device.value);
	}
	if (BFPDeviceStatus.body.devType == 'temp') {
		mqtt.publishTempStatus(this.raspyID, BFPDeviceStatus.body.ardID, BFPDeviceStatus.body.devID, device.value);
	}
	
	if (!this.config.cloud.enabled)
		this.rcpclient.sendUplinkMessage(newBFPDeviceStatus);
	/* update the IP address */
	device.IP = BFPDeviceStatus.body.IP;

	if (typeof(device.IP) == 'undefined' || device.IP == null) {	
		device.IP = this.getArduinoIP(accountID, BFPDeviceStatus.body.ardID);
		debug.log(3, 'mem', identityLog + 'Problem with obtaining IP of the device from lower layers. Obtaining IP from Arduino record: ' + device.IP);
	}

	debug.log(5, 'mem', 
		'For accountID id: ' + accountID + ', Arduino: "' + device.ardID + '", Device: "' + device.devID +
		'" Record updated by ARIF -> IP: ' + device.IP + 
		' devType: ' + device.devType +
		' dataType: ' + device.dataType +
		' value: ' + device.value +
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

/*
 * function triggered by ARiF protocol when settings message comes in.
 */
Mem.prototype.setLightSettings = function(accountID, BFPLightSettings) {
	let raspyID = BFPLightSettings.body.raspyID;
	let ardID = BFPLightSettings.body.ardID;
	let devID = BFPLightSettings.body.devID;
	let lightType = BFPLightSettings.body.lightType;
	let lightInputType = BFPLightSettings.body.lightInputType;
	let ctrlON = BFPLightSettings.body.ctrlON;
	let timer = BFPLightSettings.body.timer;
	let debug = require('./debug.js');
	let configdb = require('./configdb.js');
	let device = this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID]
	
	
	if (typeof(device) == 'undefined') {
		debug.log(1, 'mem', 'for unknown accountID: ' + accountID + ' devID: ' + devID + ', ardID: ' + ardID + ', raspyID: ' + raspyID + ' received Light Settings command!');
	} else {
		//this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID].lightInputType = BFPLightInputType.body.lightInputType;
		debug.log(4, 'mem', 'got Light settings. lightType: ' + lightType + ', lightInputType: ' + lightInputType + 
					', ctrlON: ' + ctrlON + ', timer: ' + timer + ' devID: ' + devID + ', ardID: ' + ardID);
					
		device.lightType = lightType;
		device.lightInputType = lightInputType;
		device.ctrlON = ctrlON;
		device.timer = timer;

		let updateDevice = {};
		updateDevice.devID = devID;
		updateDevice.ardID = ardID;
		updateDevice.raspyID = raspyID;
		updateDevice.lightType = lightType;
		updateDevice.lightInputType = lightInputType;
		updateDevice.ctrlON = ctrlON;
		updateDevice.timer = timer;
		
		configdb.updateDevice(accountID, updateDevice);
	}
}

Mem.prototype.setShadeSettings = function(accountID, BFPShadeSettings) {
	let raspyID = BFPShadeSettings.body.raspyID;
	let ardID = BFPShadeSettings.body.ardID;
	let devID = BFPShadeSettings.body.devID;
	let positionTimer = BFPShadeSettings.body.positionTimer;
	let tiltTimer = BFPShadeSettings.body.tiltTimer;
	
	let debug = require('./debug.js');
	let configdb = require('./configdb.js');
	let device = this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID]
	
	if (typeof(device) == 'undefined') {
		debug.log(1, 'mem', 'for unknown accountID: ' + accountID + ' devID: ' + devID + ', ardID: ' + ardID + ', raspyID: ' + raspyID + ' received Shade Settings command!');
	} else {
		debug.log(4, 'mem', 'got Shade settings. positionTimer: ' + positionTimer + ', tiltTimer: ' + tiltTimer + ', devID: ' + devID + ', ardID: ' + ardID);
		
		device.positionTimer = positionTimer;
		device.tiltTimer = tiltTimer;
		
		let updateDevice = {};
		updateDevice.devID = devID;
		updateDevice.ardID = ardID;
		updateDevice.raspyID = raspyID;
		updateDevice.devType = 'shade';
		updateDevice.positionTimer = positionTimer;
		updateDevice.tiltTimer = tiltTimer;
		
		configdb.updateDevice(accountID, updateDevice);
	}
}

Mem.prototype.reconfigureTemp = function(accountID, raspyID, ardID, devID, desc, activated) {
	let mqtt = require('./mqtt.js');
	let debug = require('./debug.js');
	let device = this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID];
	let deviceInfo = 'ArdID: ' + ardID + ', devID: ' + devID;
	
	/* MQTT handling + device activation */
	if (device.activated == true && activated == true && device.desc != desc) {
		debug.log(2, 'mem', deviceInfo + ' reconfiguring activated Temperature device. Values: desc: ' + desc);
		/* TODO: MQTT stuff here */
		mqtt.removeTemp(raspyID, ardID, devID);
		mqtt.configureTemp(raspyID, ardID, devID, desc);
	} else if (device.activated == false && activated == false) {
		debug.log(2, 'mem', deviceInfo + ' reconfiguring deactivated Temperature device. Values: desc: ' + desc);
	} else if (device.activated == false && activated == true) { /* activate device */
		debug.log(2, 'mem', deviceInfo + ' activating Temperature device.');
		device.activated = true;
		/* TODO: MQTT stuff here */
		mqtt.configureTemp(raspyID, ardID, devID, desc);
	} else if (device.activated == true && activated == false) { /* deactivate device */
		debug.log(2, 'mem', deviceInfo + ' deactivating Temperature device.');
		device.activated = false;
		/* TODO: MQTT stuff here */
		mqtt.removeTemp(raspyID, ardID, devID);
	}
	
	device.desc = desc;
}

/**
 * Change device's configuration (if necesssary adjust HA config - not done when device is not activated)
 */
Mem.prototype.reconfigureShade = function(accountID, raspyID, ardID, devID, desc, activated, positionTimer, tiltTimer) {
	let mqtt = require('./mqtt.js');
	let debug = require('./debug.js');
	let arif = require('./arif.js');
	let device = this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID];
	let deviceInfo = 'ArdID: ' + ardID + ', devID: ' + devID;
	
	/* MQTT handling + device activation */
	if (device.activated == true && activated == true && device.desc != desc) {
		debug.log(2, 'mem', deviceInfo + ' reconfiguring activated Shade device. Values: desc: ' + desc);
		mqtt.removeShade(raspyID, ardID, devID);
		mqtt.configureShade(raspyID, ardID, devID, desc);
	} else if (device.activated == false && activated == false) {
		debug.log(2, 'mem', deviceInfo + ' reconfiguring deactivated Shade device. Values: desc: ' + desc);
	} else if (device.activated == false && activated == true) { /* activate device */
		debug.log(2, 'mem', deviceInfo + ' activating Shade device.');
		device.activated = true;
		mqtt.configureShade(raspyID, ardID, devID, desc);
	} else if (device.activated == true && activated == false) { /* deactivate device */
		debug.log(2, 'mem', deviceInfo + ' deactivating Shade device.');
		device.activated = false;
		mqtt.removeShade(raspyID, ardID, devID);
	}
	
	device.desc = desc;
	
	let updateDevice = {};
	updateDevice.IP = device.IP;
	updateDevice.ardID = ardID;
	updateDevice.devID = devID;
	updateDevice.positionTimer = positionTimer;
	updateDevice.tiltTimer = tiltTimer;
	
	
	if (device.positionTimer != positionTimer) {
		arif.sendCommand(updateDevice, 'shadePTimer', function(message) {
			//socket.emit('device_response', message);
		});
	}
	if (device.tiltTimer != tiltTimer) {
		arif.sendCommand(updateDevice, 'shadeTTimer', function(message) {
			//socket.emit('device_response', message);
		});
	}
}

/**
 * Change device's configuration (if necesssary adjust HA config - not done when device is not activated)
 */
Mem.prototype.reconfigureLight = function(accountID, raspyID, ardID, devID, desc, activated, ctrlON, timer, lightType, lightInputType, extType) {
	let mqtt = require('./mqtt.js');
	let debug = require('./debug.js');
	let arif = require('./arif.js');
	let device = this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID];
	let deviceInfo = 'ArdID: ' + ardID + ', devID: ' + devID;
	
	/* MQTT handling + device activation */
	if (device.activated == true && activated == true && (device.desc != desc || device.extType != extType)) {
		debug.log(2, 'mem', deviceInfo + ' reconfiguring activated Light/Sensor device. Values: desc: ' + desc);
		mqtt.removeLight(raspyID, ardID, devID, device.extType);
		mqtt.configureLight(raspyID, ardID, devID, desc, extType);
	} else if (device.activated == false && activated == false) {
		debug.log(2, 'mem', deviceInfo + ' reconfiguring deactivated  Light/Sensor device. Values: desc: ' + desc);
	} else if (device.activated == false && activated == true) { /* activate device */
		debug.log(2, 'mem', deviceInfo + ' activating Light/Sensor device.');
		device.activated = true;
		mqtt.configureLight(raspyID, ardID, devID, desc, extType);
	} else if (device.activated == true && activated == false) { /* deactivate device */
		debug.log(2, 'mem', deviceInfo + ' deactivating Light/Sensor device.');
		device.activated = false;
		mqtt.removeLight(raspyID, ardID, devID, extType);
	}
	
	
	device.desc = desc;
	device.extType = extType;
	
	let updateDevice = {};
	updateDevice.IP = device.IP;
	updateDevice.ardID = ardID;
	updateDevice.devID = devID;
	updateDevice.extType = extType;
	if (device.ctrlON != ctrlON) {
		if (ctrlON == 1) {
			require('./arif.js').sendCommand(updateDevice, 'devCtrlON', function(message) {
				//socket.emit('device_response', message);
			});
		} else if (ctrlON == 0) {
			require('./arif.js').sendCommand(updateDevice, 'devCtrlOFF', function(message) {
				//socket.emit('device_response', message);
			});
		}
	}

	if (device.lightType != lightType) {
		updateDevice.lightType = lightType;
		arif.sendCommand(updateDevice, 'lightType', function(message) {
			//socket.emit('device_response', message);
		});
	}
	
	let msTimer = this.validateLightTimer(timer);
	if (msTimer == 0) {
		debug.log(1, 'mem', 'Not updating arduino. Timer value has incorrect format: ' + timer);
	} else if (device.timer != msTimer) {
		updateDevice.timer = msTimer;
		arif.sendCommand(updateDevice, 'lightTimer', function(message) {
			//socket.emit('device_response', message);
		});
	}
	
	if (device.lightInputType != lightInputType) {
		if (lightInputType == 0) {
			require('./arif.js').sendCommand(updateDevice, 'inputHold', function(message) {
				//socket.emit('device_response', message);
			});
		} else if (lightInputType == 1) {
			require('./arif.js').sendCommand(updateDevice, 'inputRelease', function(message) {
				//socket.emit('device_response', message);
			});
		} else if (lightInputType == 2) {
			require('./arif.js').sendCommand(updateDevice, 'inputOverrideOn', function(message) {
			//socket.emit('device_response', message);
			});
		} else if (lightInputType == 3) {
			require('./arif.js').sendCommand(updateDevice, 'inputOverrideOff', function(message) {
				//socket.emit('device_response', message);
			});
		} else if (lightInputType == 4) {
		
		}
	}
}

/**
 * convert the timer value to miliseconds, possible values are:
 * 		[number]
 *		[number]ms
 *.     [number]s
 *		[number]m
 *		[number]h
 *		
 *		if value is incorrect return 0;
 */
Mem.prototype.validateLightTimer = function(timer) {
	var debug = require('./debug.js');
	var timerRgx = /^[1-9]\d{0,8}$/;
	var msTimerRgx = /^[1-9]\d{0,8}(ms)$/;
	var sTimerRgx = /^[1-9]\d{0,3}(s)$/;
	var mTimerRgx = /^[1-9]\d{0,3}(m)$/;
	var hTimerRgx = /^[1-9]\d{0,2}(h)$/;
	var outputTimer;
	
	if (timerRgx.test(timer)) {
		return timer;
	} else if (msTimerRgx.test(timer)) {
		outputTimer = timer.slice(0, -2);
		return outputTimer;
	} else if (sTimerRgx.test(timer)) {
		outputTimer = timer.slice(0, -1);
		return outputTimer * 1000;
	} else if (mTimerRgx.test(timer)) {
		outputTimer = timer.slice(0, -1);
		return outputTimer * 60000;
	} else if (hTimerRgx.test(timer)) {
		utputTimer = timer.slice(0, -1);
		return outputTimer * 3600000;
	} else { /* if no regex is matched, means format is incorrect */
		return 0;
	}
}


/**
 * Check if device is activated, return true if yes, false otherwise
 */
Mem.prototype.isDeviceActive = function(accountID, raspyID, ardID, devID) {
	return this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID].activated;
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
	let io = this.components.getFacility('backend').io;
	let debug = require('./debug.js');
	
	debug.log(5, 'mem', '[' + accountID + '] Emitting device_status: ' + JSON.stringify(BFPDeviceStatus));
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
	arduinoToSend.desc = arduino.desc;
	arduinoToSend.ctrlON = arduino.ctrlON;
	arduinoToSend.version = arduino.version;
	arduinoToSend.mode = arduino.mode;
	arduinoToSend.mac = arduino.mac;
	arduinoToSend.uptime = arduino.uptime;
	arduinoToSend.restore = arduino.restore;
	require('./debug.js').log(5, 'mem', '[' + accountID + '] Emitting Arduino data of raspyID: ' + arduino.raspyID +
									' ardID: ' + ardID);
	
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
	require('./mqtt.js').publishArduinoOffline(raspyID, ardID);
}

function sendArduinoAliveMessage(accountID, raspyID, ardID) {
	var message = {};
	message.code = MSG_ARDUINO_ALIVE;
	message.raspyID = raspyID;
	message.ardID = ardID;
	
	io = this.components.getFacility('backend').io;
	io.of('/iot').to(accountID).emit('message', message);
	onArduinoChange(accountID, raspyID, ardID);
	require('./mqtt.js').publishArduinoOnline(raspyID, ardID);
}

/**
 *	Send to the GUI that a pending Arduino is awaiting confirmation or denial
 */
function sendPendingArduinoUpdate(raspyID, ardIP) {
	var message = {};
	var m = require('./mem.js');
	let debug = require('./debug.js');
	var pending = m.devices[m.accountID].raspys[m.raspyID].pending;
	message.code = MSG_ARDUINO_ALIVE;
	message.raspyID = raspyID;
	message.allowed = pending[ardIP].allowed;
	message.lastDate = pending[ardIP].lastDate;
	message.firstDate = pending[ardIP].firstDate;
	message.ardIP = ardIP;
	
	debug.log(5, 'mem', 'Emitting pending Arduino data: ' + JSON.stringify(message));
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
	
	return this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID];
}

/* return the whole devices structure */
Mem.prototype.getDeviceStatusAll = function() {
	return this.devices;
}

Mem.prototype.getClientDevices = function (accountID) {
	return this.devices[accountID];
}

/* 
 * Request for a VPNKey during initial VPN setup. 
 */
Mem.prototype.requestVPNKey = function() {
	let accountID = this.config.cloud.id;
	let raspyID = require('./config.js').rcpclient.vpnID.split('-')[1];
	let raspy = this.devices[accountID].raspys[raspyID];
	
	if (raspy.initSetupFlag) {
		let debug = require('./debug.js');
		let rcpclient = require('./rcpclient.js');
		debug.log(4, 'mem', 'Initil VPN Connection set up succesfully. Requesting VPNKey');
		rcpclient.requestVPNKey(function (error, vpnKey) {
			if (error) {
				debug.log(1, 'mem', 'Error while requesting VPNKey on initial setup: ' + error);
				return;
			}
			
			debug.log(5, 'mem', 'Received answer for VPNKey request: ' + vpnKey);
			require('./mem.js').setVPNKey(accountID, raspyID, vpnKey);
		});
	}
}

/**
 * Set VPNKey 
 */

Mem.prototype.setVPNKey = function(accountID, raspyID, vpnkey) {
	let db = require('./configdb.js');
	let os = require('./os.js');
	
	db.setVpnID(accountID, raspyID, undefined, undefined, vpnkey);
	this.devices[accountID].raspys[raspyID].vpnkey = vpnkey
	os.setVPNCredentials(this.devices[accountID].raspys[raspyID].vpnID, vpnkey, function(err) {
		if (!err) {
			os.restartVPN(function(error, output) {
				
			});
		}
	});
}

/**
 * return vpnKey value for a given account/raspy
 */
Mem.prototype.getVPNKey = function (accountID, raspyID) {
	if (typeof(this.devices[accountID]) == 'undefined') {
		return null;
	}
	if (typeof(this.devices[accountID].raspys[raspyID]) == 'undefined') {
		return null;
	}
	
	if (typeof(this.devices[accountID].raspys[raspyID].vpnKey) == 'undefined') {
		return null;
	} else {
		return this.devices[accountID].raspys[raspyID].vpnKey;
	}
}

/**
 * Load the latest vpnKey from the DB
 * return vpnKey for a given accountID/raspyID.
 */
Mem.prototype.getLatestVPNKey = function (accountID, raspyID, callback) {
	if (typeof(this.devices[accountID]) == 'undefined') {
		this.devices[accountID] = {};
		this.devices[accountID].raspys = {};
	}
	if (typeof(this.devices[accountID].raspys[raspyID]) == 'undefined') {
		this.devices[accountID].raspys[raspyID] = {};
	}
	let raspy = this.devices[accountID].raspys[raspyID];
	let db = require('./configdb.js');
	db.getVpnID(accountID, raspyID, function(error, vpnID, vpnKey, initVpnKey, cloud) {
		if (!error) {
			raspy.vpnKey = vpnKey;
			raspy.initVpnKey = initVpnKey;
			callback(false, vpnKey, initVpnKey);
		} else {
			callback(true, null, null);
		}
	});
	
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
	
	// in case arduino has been deleted meanwhile
	if (!arduino) return;
	
	if (arduino.alive != true) { //true 
		require('./rcpclient.js').sendArduinoAlive(ardID);
		this.setArduinoAlive(accountID, raspyID, ardID);
	}
	arduino.counter = 0
	
}

/* clear the Raspy dead counter (only cloud) */
Mem.prototype.clearRaspyDeadCounter = function(accountID, raspyID) {
	let debug = require('./debug.js');
	let configdb = require('./configdb.js');
	
	if (typeof(this.devices[accountID]) == 'undefined') {
		debug.log(1, 'mem', '[' + accountID + '] accountID not found in DB - this should not happen!');
		return;
	}
	this.devices[accountID].raspys[raspyID].counter = 0
	this.setRaspyAlive(accountID, raspyID);
	
	const date = require('date-and-time');
	const now =  new Date();
	var raspy = {}
	raspy.lastSeen = date.format(now,'YYYY-MM-DD HH:mm:ss');
	raspy.raspyID = raspyID;
	raspy.alive = true;

	configdb.updateRaspy(accountID, raspy);
}

/* sets a given Arduino status dead and all its devices (both raspy and cloud) */
Mem.prototype.setArduinoDead = function(accountID, raspyID, ardID) {
	var arduino = this.devices[accountID].raspys[raspyID].arduinos[ardID];
	let mqtt = require('./mqtt.js');
	arduino.alive = false;

	for (var devID in arduino.devices) {
		if (arduino.devices.hasOwnProperty(devID)){
			var device = this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID];
			
			if (device.alive == true || typeof(device.alive) == 'undefined') {
				this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID].alive = false;
				var BFPDeviceStatus = require('./bfp.js').BFPCreateDeviceStatusFromMem(device);
				onValueChange(accountID, BFPDeviceStatus);
				/* also send to MQTT */
				
				mqtt.publishDeviceOffline(raspyID, ardID, devID);
				
				this.components.getFacility('debug').log(5, 'mem', '[' + accountID + '] ArdID and its devIDs declared dead: ' + 
						ardID + ' on raspyID: ' + raspyID + ' devID: ' + devID);
			}
		}
	}
	sendArduinoDeadMessage(accountID, raspyID, ardID);
	mqtt.publishArduinoOffline(raspyID, ardID);
}

/* sets a given Arduino status alive and all its devices (both raspy and cloud) */
Mem.prototype.setArduinoAlive = function(accountID, raspyID, ardID) {
	this.devices[accountID].raspys[raspyID].arduinos[ardID].alive = true;
	let mqtt = require('./mqtt.js');
	
	for (var devID in this.devices[accountID].raspys[raspyID].arduinos[ardID].devices) {
		if (this.devices[accountID].raspys[raspyID].arduinos[ardID].devices.hasOwnProperty(devID)){
			var device = this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID];
			if (device.alive == false || typeof(device.alive) == 'undefined') {
				device.alive = true;
				this.components.getFacility('debug').log(5, 'mem', '[' + accountID + '] ArdID and its devIDs declared alive: ' + 
						ardID + ' on raspyID: ' + raspyID + ' devID: ' + devID);
				var BFPDeviceStatus = require('./bfp.js').BFPCreateDeviceStatusFromMem(device);
				onValueChange(accountID, BFPDeviceStatus);
				
				/* also send to MQTT */
				mqtt.publishDeviceOnline(raspyID, ardID, devID);
			}
		}
	}
	sendArduinoAliveMessage(accountID, raspyID, ardID);
	mqtt.publishArduinoOnline(raspyID, ardID);
}

/* sets give Raspy status to alive (only cloud) */
Mem.prototype.setRaspyAlive = function(accountID, raspyID) {
	
	var raspy = this.devices[accountID].raspys[raspyID];
	if (raspy.alive == false || typeof(raspy.alive) == 'undefined') {
		raspy.alive = true;
		require('./debug.js').log(5, 'mem', '[' + accountID + '] raspyID and its devices alive: ' + raspyID);
	}
	
}

/* sets give Raspy status to dead (only cloud) */
Mem.prototype.setRaspyDead = function(accountID, raspyID, ardID) {
	let configdb = require('./configdb.js');
	var raspy = this.devices[accountID].raspys[raspyID];
	if (raspy.alive == true || typeof(raspy.alive) == 'undefined') {
		raspy.alive = false;
		require('./debug.js').log(5, 'mem', '[' + accountID + '] raspyID and its devices dead: ' + raspyID);
		
		/* putting state into the DB */
		var raspyUpdate = {}
		raspyUpdate.raspyID = raspyID;
		raspyUpdate.alive = false;
		configdb.updateRaspy(accountID, raspyUpdate);
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

			if (arduinos[ardID].alive == true)
				require('./rcpclient.js').sendArduinoAlive(ardID);
			else
				require('./rcpclient.js').sendArduinoDead(ardID);

			for (var devID in devices) {
				if (devices.hasOwnProperty(devID)){
					var device = devices[devID];
					var BFPDeviceStatus = require('./bfp.js').BFPCreateDeviceStatusFromMem(device);
					//rcpclient.sendDeviceStatus(this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID]);

					rcpclient.sendUplinkMessage(BFPDeviceStatus);
					this.components.getFacility('debug').log(5, 'mem', '[' + accountID + '] Device found to update Cloud, ardID: ' + 
							device.ardID + ' on raspyID: ' + device.raspyID + ' devID: ' + device.devID);
				}
			}
		}
	}
}

/* set pending arduino information. Could be used for the first time arduino is seen or
   every other time */
Mem.prototype.updatePendingArduino = function(ardIP) {
	let pending = this.devices[this.accountID].raspys[this.raspyID].pending;
	let date = new Date();
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
	let pending = this.devices[this.accountID].raspys[this.raspyID].pending;
	if (typeof(pending[ardIP]) == 'undefined')
		return false;
	
	return pending[ardIP].allowed;
}

/**
 *	Set this pending arduino to be allowed to register (both raspy and cloud function)
 */ 
Mem.prototype.allowPendingArduino = function(accountID, raspyID, ardIP) {
	let debug = require('./debug.js');
	let pending = this.devices[accountID].raspys[raspyID].pending;
	
	if (typeof(pending) != 'undefined') {
		pending[ardIP].allowed = true;
	} else {
		debuug.log(1, 'mem', 'Trying to Register non pending ardID: ' + ardIP)
	}
}

/**
 * Remove pending arduino information from the mem structure (both raspy and cloud function)
 */
Mem.prototype.removePendingArduino = function(accountID, raspyID, ardIP) {
	let pending = this.devices[accountID].raspys[raspyID].pending;
	delete pending[ardIP];
}

/**
 * Update arduino information in the mem structure (both raspy and cloud function)
 * trigger also DB entry update.
 */
Mem.prototype.updateArduino = function(accountID, raspyID, ardID, desc, ctrlON, mode) {
	let arduino = this.devices[accountID].raspys[raspyID].arduinos[ardID];
	let updateArduino = {};
	let arif = require('./arif.js');
	let debug = require('./debug.js');
	let mqtt = require('./mqtt.js');
	debug.log(4, 'mem', 'Updating Arduino entry with name: ' + desc + ', ardID: ' + ardID);
	
	updateArduino.raspyID = raspyID;
	updateArduino.ardID = ardID;
	if (arduino.desc != desc) {
		arduino.desc = desc;
		updateArduino.desc = desc;
		mqtt.renameArduino(raspyID, ardID, desc);
		require('./configdb.js').updateArduino(accountID, updateArduino);
	}
	
	//updateArduino.raspyID = raspyID;
	let device = {};
	device.devID = 0;
	device.ardID = ardID;
	device.IP = arduino.IP;
	
	//updateArduino.ardID = ardID;
	if (arduino.ctrlON != ctrlON) {
		/* update ARiF */
		if (arduino.ctrlON == 0 && ctrlON == 1)
			arif.sendCommand(device, 'ctrlON');
		else if (arduino.ctrlON == 1 && ctrlON == 0)
			arif.sendCommand(device, 'ctrlOFF');
		else
			debug.log(5, 'mem', 'ctrlON - no update needed.');
	}
	if (arduino.mode != mode) {
		/* update ARiF */
		if (mode == 0) {
			this.removeAllShades(accountID, raspyID, ardID);
			arif.sendCommand(device, 'modeLights');
		} else if (mode == 1) {
			this.removeAllLights(accountID, raspyID, ardID);
			arif.sendCommand(device, 'modeShades');
		} else {
			debug.log(1, 'mem', 'unrecognized mode received - nothing sent over ARiF.');
		}
	}
}

/**
 * Remove all light devices from a given arduino
 */
Mem.prototype.removeAllLights = function(accountID, raspyID, ardID) {
	let arduino = this.devices[accountID].raspys[raspyID].arduinos[ardID];
	let debug = require('./debug.js');
	let db = require('./configdb.js');
	let mqtt = require('./mqtt.js');
	
	for (var devID in arduino.devices) {
		var device = arduino.devices[devID];
		if (device.devType == 'digitOUT') {
			debug.log(3, 'mem', 'deleting light devID: ' + device.devID + ' from arduino: ' + ardID);
			db.deleteDevice(accountID, device);
			if (device.activated == true){
				mqtt.removeLight(raspyID, ardID, devID, device.extType);
			}
			delete this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID];
		}
	}
}

/**
 * Remove all shades devices from a given arduino
 */
Mem.prototype.removeAllShades = function(accountID, raspyID, ardID) {
	let arduino = this.devices[accountID].raspys[raspyID].arduinos[ardID];
	let debug = require('./debug.js');
	let db = require('./configdb.js');
	let mqtt = require('./mqtt.js');
	
	for (var devID in arduino.devices) {
		var device = arduino.devices[devID];
		if (device.devType == 'shade') {
			debug.log(3, 'mem', 'deleting shade devID: ' + device.devID + ' from arduino: ' + ardID);
			db.deleteDevice(accountID, device);
			if (device.activated == true){
				mqtt.removeShade(raspyID, ardID, devID);
			}
			delete this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID];
		}
	}
}

/**
 * Clear the discovered flag, so that it doesn't appear anymore in discovered devices tab.
 *
 */
Mem.prototype.clearDeviceDiscovered = function(accountID, raspyID, ardID, devID) {
	let device = this.devices[accountID].raspys[raspyID].arduinos[ardID].devices[devID];

	device.discovered = false;
}

/**
 * Sets the MAC address of an arduino
 */
Mem.prototype.updateArduinoMAC = function(accountID, raspyID, ardID, MAC) {
	let arduino = this.devices[accountID].raspys[raspyID].arduinos[ardID]
	arduino.mac = MAC;
	let updateArduino = {};
	require('./debug.js').log(4, 'mem', 'Updating Arduino MAC entry: ' + MAC + ', ardID: ' + ardID);
	updateArduino.mac = MAC;
	updateArduino.raspyID = raspyID;
	updateArduino.ardID = ardID;
	
	require('./configdb.js').updateArduino(accountID, updateArduino);
}

/**
 * Function to set the Arduino CtrlON functionality
 */
Mem.prototype.setCtrlON = function(accountID, BFPCtrl) {
	let arduino = this.devices[accountID].raspys[BFPCtrl.body.raspyID].arduinos[BFPCtrl.body.ardID];
	
	arduino.ctrlON = BFPCtrl.header.enabled;
	require('./debug.js').log(4, 'mem', '[' + accountID + '] setting CtrlON of ardID: ' + BFPCtrl.body.ardID + ' to: ' + arduino.ctrlON);
	
	onArduinoChange(accountID, BFPCtrl.body.raspyID, BFPCtrl.body.ardID);
}

/**
 * Function to set the Arduino settings - arduino specific settings and parameters
 */
Mem.prototype.setSettings = function(accountID, BFPSettings) {
	let arduino = this.devices[accountID].raspys[BFPSettings.body.raspyID].arduinos[BFPSettings.body.ardID];
	let configdb = require('./configdb.js');
	
	arduino.ctrlON = BFPSettings.body.ctrlON;
	arduino.mode = BFPSettings.body.mode;
	arduino.version = BFPSettings.body.version;
	arduino.uptime = BFPSettings.body.uptime;
	arduino.restore = BFPSettings.body.restore;
	
	let updateArduino = {};
	updateArduino.ardID = BFPSettings.body.ardID;
	updateArduino.raspyID = BFPSettings.body.raspyID;
	updateArduino.ctrlON = BFPSettings.body.ctrlON;
	updateArduino.mode = BFPSettings.body.mode;
	updateArduino.version = BFPSettings.body.version;
	configdb.updateArduino(accountID, updateArduino);
	
	require('./debug.js').log(4, 'mem', '[' + accountID + '] setting on ardID: ' + BFPSettings.body.ardID + ' ctrlON: ' + arduino.ctrlON + ' version: ' + arduino.version + ' mode: ' + arduino.mode + ' uptime: ' + arduino.uptime);
	
	onArduinoChange(accountID, BFPSettings.body.raspyID, BFPSettings.body.ardID);
}

/**
 * Function to set the VPN status UP
 *
 */

Mem.prototype.setVPNStateUP = function() {
	let accountID = this.config.cloud.id;
	let raspyID = require('./config.js').rcpclient.vpnID.split('-')[1];
	let raspy = this.devices[accountID].raspys[raspyID];
	raspy.VPNConnected = true;
}

/**
 * Function to set the VPN status UP
 *
 */

Mem.prototype.setVPNStateDOWN = function() {
	let accountID = this.config.cloud.id;
	let raspyID = require('./config.js').rcpclient.vpnID.split('-')[1];
	let raspy = this.devices[accountID].raspys[raspyID];
	raspy.VPNConnected = false;
}

/**
 *  Function to check the state of the VPN connection
 */
Mem.prototype.getVPNStatus = function() {
	let accountID = this.config.cloud.id;
	let raspyID = require('./config.js').rcpclient.vpnID.split('-')[1];
	let raspy = this.devices[accountID].raspys[raspyID];
	return raspy.VPNConnected;
}

/**
 * function to check if VPN is enabled
 */
Mem.prototype.getVPNCloudEnabled = function() {
	let accountID = this.config.cloud.id;
	let raspyID = require('./config.js').rcpclient.vpnID.split('-')[1];
	let raspy = this.devices[accountID].raspys[raspyID];
	return raspy.cloud;
}

/**
 * Function to set the last Error of the VPN connection
 */
Mem.prototype.setVPNLastError = function(lastError) {
	let accountID = this.config.cloud.id;
	let raspyID = require('./config.js').rcpclient.vpnID.split('-')[1];
	let raspy = this.devices[accountID].raspys[raspyID];
	raspy.lastError = lastError;
}

/**
 * Function to get the last Error of the VPN connection
 */
Mem.prototype.getVPNLastError = function() {
	let accountID = this.config.cloud.id;
	let raspyID = require('./config.js').rcpclient.vpnID.split('-')[1];
	let raspy = this.devices[accountID].raspys[raspyID];
	return raspy.lastError;
}

/**
 * Function to return the initSetupFlag related to VPN.
 */
Mem.prototype.getInitSetupFlag = function() {
	let accountID = this.config.cloud.id;
	let raspyID = require('./config.js').rcpclient.vpnID.split('-')[1];
	let raspy = this.devices[accountID].raspys[raspyID];
	return raspy.initSetupFlag;
}

/**
 * Function to setup the initServiceFlag related to VPN
 */
Mem.prototype.setInitSetupFlag = function(value) {
	let accountID = this.config.cloud.id;
	let raspyID = require('./config.js').rcpclient.vpnID.split('-')[1];
	let raspy = this.devices[accountID].raspys[raspyID];
	raspy.initSetupFlag = value;
	let db = require('./configdb.js');
	db.setVpnID(accountID, raspyID, undefined, undefined, undefined, undefined, value);
}

/**
 * Function to return the vpnKeyReceived flag related to VPN.
 */
Mem.prototype.getVpnKeyReceivedFlag = function() {
	let accountID = this.config.cloud.id;
	let raspyID = require('./config.js').rcpclient.vpnID.split('-')[1];
	let raspy = this.devices[accountID].raspys[raspyID];
	return raspy.vpnKeyReceivedFlag;
}

/**
 * Function to set the vpnKeyReceived flag related to VPN.
 */
Mem.prototype.setVpnKeyReceivedFlag = function(value) {
	let accountID = this.config.cloud.id;
	let raspyID = require('./config.js').rcpclient.vpnID.split('-')[1];
	let raspy = this.devices[accountID].raspys[raspyID];
	raspy.vpnKeyReceivedFlag = value;
}

/**
 * Function to send the cloud VPN connection status 
 */ 
Mem.prototype.sendCloudStatus = function() {
	let accountID = this.config.cloud.id;
	let config = this.config;
	let raspyID = config.rcpclient.vpnID.split('-')[1];
	let raspy = this.devices[accountID].raspys[raspyID];
	
	let io = this.components.getFacility('backend').io;
	let debug = require('./debug.js');
	
	let host;
	let port;
	let vpnID;
	let BFPCloudStatus;
	let vpnStatus;
	let lastError;
	
	if (raspy.cloud) {
		status = require('./rcpclient.js').isCloudAlive;
		host = config.rcpclient.host;
		port = config.rcpclient.port;
		vpnID = raspy.vpnID;
		vpnStatus = raspy.VPNConnected;
		lastError = raspy.lastError;
		BFPCloudStatus = require('./bfp.js').BFPCreateCloudStatus(true, status, vpnStatus, host, port, vpnID, null, lastError);
	} else {
		BFPCloudStatus = require('./bfp.js').BFPCreateCloudStatus(false);
	}
	
	debug.log(5, 'mem', '[' + accountID + '] Emitting cloud_status: ' + JSON.stringify(BFPCloudStatus));
	
	io.of('/iot').to(accountID).emit('cloud_status', BFPCloudStatus);
	
}

function connectVPN() {
	let os = require('./os.js');
	let config = require('./config.js');
	let raspyID = require('./config.js').rcpclient.vpnID.split('-')[1];
	let accountID = config.cloud.id;
	let devices = require('./mem.js').getClientDevices(accountID);
	let raspy = devices.raspys[raspyID];
	
	os.isVPNenabled(function(error, enabled) {
		if (!error) {
			if (enabled) {
				os.getVPNStatus(function(statusError, status) {
					if (!statusError) {
						if (!status) { // VPN enabled, but not started
							os.startVPN(function(startError, output) {
								debug.log(1, 'init', 'Found VPN enabled, but not started. Starting.');
							});
						} else { // VPN enabled and started
							raspy.VPNConnected = os.isVPNConnected();
							debug.log(1, 'init', 'Found VPN enabled and started, Status: ' + raspy.VPNConnected);
						}
					}
				});
			} else {
				os.enableVPN(function(enableError, enableOutput) {
					if (!enableError) {
						os.startVPN(function(startError, startOutput) {
							debug.log(1, 'init', 'Found VPN not enabled and not started. Enabling and starting.');
						});
					}
				});
			}
		}
	});
}

/*
 * Function to calculate kWh from reported W over time
 */
function calculatekWh(timer, value) {
	var hourFraction;
	var multiplier = require('./config.js').mem.wattMultiplier;
	var Watts = value * multiplier;
	hourFraction = timer / 3600000;
	var kWh = Watts * hourFraction / 1000;
	debug.log(5, 'mem', 'Recalculated kWh value: ' + kWh + ' from value: ' + value + ' and multiplier: ' + multiplier);
	return kWh;
}


module.exports = memory;
