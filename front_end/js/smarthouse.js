
const COMMAND_ON = 1;
const COMMAND_CLEAR = 0;

var devices = {};

var command = {};

/* function to update device data in internal 'devices' data structure */
function updateDevice(device) {
	devID = device.devID;
	ardID = device.ardID;
	raspyID = device.raspyID;
	if (typeof(devices[raspyID]) == 'undefined') {
		devices[raspyID] = {};
		console.log('new raspy: ' + raspyID);
	}
	if (typeof(devices[raspyID][ardID]) == 'undefined') {
		devices[raspyID][ardID] = {};
		console.log('new ard: ' + ardID)
	}
	
	devices[raspyID][ardID][devID] = device;
}

/* get device value */
function getDeviceValue(device){
	return devices[device.raspyID][device.ardID][device.devID].value;
}

/* get device description */
function getDeviceDesc(device){
	return devices[device.raspyID][device.ardID][device.devID].desc;
}

/* set device timer */
function setDeviceTimer(device, timer) {
	devices[device.raspyID][device.ardID][device.devID].timer = timer;
}

/* clear device timer */
function clearDeviceTimer(device) {
	clearInterval(devices[device.raspyID][device.ardID][device.devID].timer);
}

/* provides a string name of status of a device (selects the right status based on the device type) */
function devValueGetName(devType, value) {
	switch (devType){
		case '1':
			if (value == '0') 
				return 'OFF';
			else
				return 'ON';
			break;
		default:
			return value;
	}
}
 
/* provides string name of a device type based on devType variable */
function devTypeGetName(devType) {
	console.log('type: ' + devType);
	switch (devType) {
		case '1':
			return 'Light';
			break;
		case '2':
			return 'Switch';
			break;
		case '3':
			return 'Sensor';
			break;
		case '4':
		    return 'Vent';
			break;
		case '5':
		    return 'Shade';
			break;
		case '6':
		    return 'Arduino';
			break;
		default:
		    return 'Unknown';
			break;
	}
}

/* function used to create light switch button */
function createLightButton(device) {
	var color = 'small red';
	if (device.value) color = 'small green';
	var button;
	button = '<button id="' + device.raspyID + '-' + device.devID + '-' + device.ardID + '_switch"';
	button += 'class="' + color;
	button += '">Switch</button>';
	
	return button;
}

function grayOutLightButton(device) {
	var buttonID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_switch';
	$('#' + buttonID).attr("disabled", "disabled");
	$('#' + buttonID).attr("class", "small");
	//console.log('graying out: ', buttonID);
}

function makeGreenLightButton(device) {
	var buttonID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_switch';
	$('#' + buttonID).removeAttr("disabled");
	$('#' + buttonID).attr("class", "small green");
	//console.log('graying out: ', buttonID);
}

function getDeviceCommandStatus(device) {
	return devices[device.raspyID][device.ardID][device.devID].command;
}

function setDeviceCommandOn(device) {
	devices[device.raspyID][device.ardID][device.devID].command = COMMAND_ON;
}

function setDeviceCommandClear(device) {
	devices[device.raspyID][device.ardID][device.devID].command = COMMAND_CLEAR;
}

function onCommandTimeout(device) {
	
	if (getDeviceCommandStatus(device) == COMMAND_ON) {
		console.log('timeout');
		onError('Timeout while waiting for device status: ' + getDeviceDesc(device) + ' (3)');
		makeGreenLightButton(device);
		setDeviceCommandClear(device)
	} else {
		// nothing to do
	}
}

/* function to create Activation Button, look depending on device state */
function createActivationButton(device) {
	var color = 'small red';
	var label = ' deactivate';
	var icon = '<i class="fa fa-minus-square">'
	if (!device.activated) { 
		color = 'small green';
		label = ' activate';
		icon = '<i class="fa fa-plus-square">'
	}
	var button;
	button = '<button id="' + device.raspyID + '-' + device.devID + '-' + device.ardID + '_activate"';
	button += 'class="' + color;
	button += '">' + icon + label + '</button>';
	
	return button;
}

// color the status-bar div on successful connection
function onConnect(msg) {
	console.log("connected to server.");
	message = '<div id="status-bar" class="notice success"><i class="icon-remove-sign icon-large"></i> Connected to Server <a href="javascript:closeStatusBar();" class="fa fa-remove"></a></div>'
	$('#status-bar').remove();
	$('#status-handle').append(message);
}

// color the status-bar on connection error
function onConnectError(msg) {
	console.log("Connection Error!");
	message1 = '<div id="status-bar" class="notice error"><i class="icon-remove-sign icon-large"></i>'; 
	message2 = '<a href="javascript:closeStatusBar();" class="fa fa-remove"></a></div>';
	$('#status-bar').remove();
	$('#status-handle').append(message1 + ' Server connection problem: ' + msg + ' ' + message2);
}

function onError(msg) {
	console.log("other error: " + msg);
	message1 = '<div id="status-bar" class="notice error"><i class="icon-remove-sign icon-large"></i>'; 
	message2 = '<a href="javascript:closeStatusBar();" class="fa fa-remove"></a></div>';
	$('#status-bar').remove();
	$('#status-handle').append(message1 + ' Error: ' + msg + ' ' + message2);
}

function closeStatusBar() {
	$('#status-bar').fadeOut('fast', 'swing', function() {
		$('#status-bar').remove();
	});
}
	  