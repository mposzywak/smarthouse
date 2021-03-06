
const DIGITOUT = 'digitOUT';
const DIGITIN = 'digitIN';
const SHADE_STOP = 0;
const SHADE_DOWN = 1;
const SHADE_UP = 2;
const SHADE = 10;

/* Debug facility initialization */
var Devices = function() {
	this.config = require('./config.js');
	this.debug = require('./debug.js');
	this.arif = require('./arif.js');
	//this.components = require('./components.js').setFacility(this, 'devices');
	this.devices = {}
	// INs (lights)
	this.devices['1'] = {}
	this.devices['1'].type = DIGITIN;
	this.devices['1'].control = ['10'];
	this.devices['2'] = {}
	this.devices['2'].type = DIGITIN;
	this.devices['2'].control = ['11', '12'];
	// INs (shades)
	this.devices['5'] = {}
	this.devices['5'].type = DIGITIN;
	this.devices['5'].subtype = SHADE_UP;
	this.devices['5'].shadeID = 1;
	this.devices['5'].control = ['20'];
	this.devices['6'] = {}
	this.devices['6'].type = DIGITIN;
	this.devices['6'].subtype = SHADE_DOWN;
	this.devices['6'].shadeID = 1;
	this.devices['6'].control = ['21'];
	// OUTs
	this.devices['10'] = {}
	this.devices['10'].type = DIGITOUT;
	this.devices['10'].status = 0;
	this.devices['11'] = {}
	this.devices['11'].type = DIGITOUT;
	this.devices['11'].status = 0;
	this.devices['12'] = {}
	this.devices['12'].type = DIGITOUT;
	this.devices['12'].status = 0;
	// OUTs shades
	this.devices['20'] = {}
	this.devices['20'].type = DIGITOUT;
	this.devices['20'].subtype = SHADE_UP;
	this.devices['20'].shadeID = 1;
	this.devices['20'].status = 0;
	this.devices['21'] = {}
	this.devices['21'].type = DIGITOUT;
	this.devices['21'].subtype = SHADE_DOWN;
	this.devices['21'].shadeID = 1;
	this.devices['21'].status = 0;
}

var devices = new Devices();

Devices.prototype.showDevices = function(line) {
	for (var devID in this.devices) {
		if (this.devices[devID].type == DIGITIN) {
			console.log('\tdevID = ' + devID + ' [digitIN] - controls: ' + JSON.stringify(this.devices[devID].control));
			if (typeof(this.devices[devID].shadeID) != 'undefined')
				console.log('\tdevID = ' + devID + ' [digitIN] - shadeID: ' + JSON.stringify(this.devices[devID].shadeID));
		}
		else {
			console.log('\tdevID = ' + devID + ' [digitOUT] - status: ' + this.devices[devID].status);
			if (typeof(this.devices[devID].shadeID) != 'undefined')
				console.log('\tdevID = ' + devID + ' [digitOUT] - shadeID: ' + JSON.stringify(this.devices[devID].shadeID));
		}
	}
}

/* toggle a Digital IN device */
Devices.prototype.toggle = function(devID) {
	if (this.devices[devID].type == DIGITOUT) {
		this.debug.log(4, 'devices', 'devID: ' + devID + ' is of type digitOUT - cannot toggle!');
		return false;
	} else {
		var control = this.devices[devID].control;
		require('./arif.js').sendDeviceStatus(devID, this.getDeviceStatus(devID), true);
		for (var i in control) {
			console.log('dev: ' + control[i]);
			this.digitOUTChangeState(control[i]);
			require('./arif.js').sendDeviceStatus(control[i], this.getDeviceStatus(control[i]), true);
		}
		return true;
	}
}

/* get status of a given device, only for digitOUT types */
Devices.prototype.getDeviceStatus = function(devID) {
	if (this.devices[devID].type == DIGITIN) {
		// in case of digitIN - always return '1'
		return '1';
		return false;
	} else {
		return this.devices[devID].status;
	}
}

Devices.prototype.getDeviceType = function(devID) {
	return this.devices[devID].type;
}

/* change the state of a digital out */
Devices.prototype.digitOUTChangeState = function(devID) {
	if (this.devices[devID].type == DIGITIN) {
		debug.log(4, 'devices', 'devID is of type digitIN - cannot change status');
		return false;
	} else {
		var status = this.devices[devID].status;
		if (status == 0)
			this.devices[devID].status = 1;
		else
			this.devices[devID].status = 0;
		return true;
	}
}

/* check if device (digitIN or digitOUT) belongs to shade group device and return shadeID,
   if no shadeID found - return 0 */
Devices.prototype.getDeviceShadeID = function(devID) {
	if (typeof(this.devices[devID].shadeID)) {
		return this.devices[devID].shadeID;
	} else {
		return 0;
	}
}

module.exports = devices;
