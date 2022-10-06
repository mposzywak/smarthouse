
/* BFP (Backend Frontend Protocol) commands */
const BFP_HEARTBEAT = 'heartbeat';
const BFP_LIGHTON = 'lightON';
const BFP_LIGHTOFF = 'lightOFF';
const BFP_SHADEPOS = 'shadePOS';
const BFP_SHADETILT = 'shadeTILT';
const BFP_SHADEUP = 'shadeUP';		/* not used right now from the front-end */
const BFP_SHADEDOWN = 'shadeDOWN';  /* not used right now from the front-end */
const BFP_SHADESTOP = 'shadeSTOP';  /* not used right now from the front-end */

/* command send status */
const COMMAND_ON = 1;
const COMMAND_CLEAR = 0;

/* devTypes */
const TYPE_DIGITIN = 'digitIN';
const TYPE_DIGITOUT = 'digitOUT';
const TYPE_SHADE = 'shade';
const TYPE_TEMP = 'temp';

/* consts for message codes */
const MSG_ARDUINO_DEAD = 0;
const MSG_ARDUINO_ALIVE = 1;
 
const BFP_DEVICE_COMMAND = 'BFP_DEVICE_COMMAND';
const BFP_CLOUD_SETTINGS = 'BFP_CLOUD_SETTINGS';
const BFP_SYNC_HA = 'BFP_SYNC_HA';

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
	
	if (typeof(devices[raspyID][ardID][devID]) == 'undefined') {
		devices[raspyID][ardID][devID] = device;
	} else {
		devices[raspyID][ardID][devID].value = device.value;
		//devices[raspyID][ardID][devID].direction == device.direction;
	}
	
}

/* set the Slider of the device in motion (it should then not be updated according to the incoming status msgs) */
function setDeviceShadeInMotion(device) {
	devices[device.raspyID][device.ardID][device.devID].inMotion = true;
}

/* sets the Slider of the device as stopped */
function setDeviceShadeStopped(device) {
	devices[device.raspyID][device.ardID][device.devID].inMotion = false;
}

function isDeviceInMotion(device) {
	//if (typeof(devices[device.raspyID][device.ardID][device.devID].inMotion) != 'undefined')
	return devices[device.raspyID][device.ardID][device.devID].inMotion;
	//else
		//return false;
}

/* return inMotion boolean variable */
function getDeviceShadeMotion(device) {
	return devices[device.raspyID][device.ardID][device.devID].inMotion;
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
		displayErrorMsg('Timeout while waiting for device status: ' + getDeviceDesc(device) + ' (3)');
		enableLightButton(device);
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

/*
 * Message displaying section
 */

/* this variable represents last status so that the error message is not updated all the time,
   but only during change of condition */
const CONNECTION_ERROR = 0;
const CONNECTION_EXISTS = 1;

var WSConnection = CONNECTION_EXISTS;

/* display success (green) message at the top of a page */
function displaySuccessMsg(msg) {
	
	var statusBar = '<div class="alert alert-success alert-dismissible fade show" id="status-bar" role="alert"> \
					<button type="button" class="close" data-dismiss="alert" aria-label="Close"> \
						<span aria-hidden="true">&times;</span> \
					</button> \
					<br> \
					<strong>Success!</strong> ' + msg + ' \
			   </div>';

	$("#message-holder").append(statusBar);  
}

/* remove status bar */
function removeMsg() {
	$("#status-bar").remove();
}

/* display Error (red) message at the top of a page */
function displayErrorMsg(msg) {
	
	var row = '<div class="alert alert-danger alert-dismissible fade show" id="status-bar" role="alert"> \
					<button type="button" class="close" data-dismiss="alert" aria-label="Close"> \
						<span aria-hidden="true">&times;</span> \
					</button> \
					<br> \
					<strong>Oh Snap!</strong> ' + msg + ' \
			   </div>';
			   
	$("#message-holder").append(row);  
}

/* executed each time there is a succesfull WS connection to the back end */
function onConnectError() {
	if (WSConnection == CONNECTION_EXISTS) {
		removeMsg();
		displayErrorMsg('Cannot connect to the cloud. Check your internet connection.');
		WSConnection = CONNECTION_ERROR;
	}
}


function onError() {
	removeMsg();
	displayErrorMsg('Cannot establish properly connection to the cloud. Try to re-login.');
	WSConnection = CONNECTION_ERROR;
	//window.location.replace('');
	window.location.href = '/'
}

/* executed each time there is a failure during WS connection to the back end */
function onConnect() {
	if (WSConnection == CONNECTION_ERROR) {
		removeMsg();
		displaySuccessMsg('Connection to the cloud established succesfully.');
		WSConnection = CONNECTION_EXISTS;
	}
}

function onReconnectError(error) {
	console.log('WS reconnect_error received: ' + error);
}

function onReconnectFailed() {
	console.log('WS reconnect_failed received.');
}

/* executed each time when "message" call comes out of WS */
function onMessage(msg) {
	console.log('Message received, code: ' + msg.code);
	if (msg.code == MSG_ARDUINO_ALIVE) {
		removeMsg();
		displaySuccessMsg('Arduino with ID ' + msg.ardID + ' restored connectivity.');
	} else if (msg.code == MSG_ARDUINO_DEAD) {
		removeMsg();
		displayErrorMsg('Arduino with ID ' + msg.ardID + ' lost connectivity. Some devices might not be available.');
	}
}

/*function closeStatusBar() {
	$('#status-bar').fadeOut('fast', 'swing', function() {
		$('#status-bar').remove();
	});
}*/

/* variable containing URL query string parameters */
var urlParams;

/* function executed on page load to fill in the urlParams page */
(window.onpopstate = function () {
    var match,
        pl     = /\+/g,  // Regex for replacing addition symbol with a space
        search = /([^&=]+)=?([^&]*)/g,
        decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
        query  = window.location.search.substring(1);

    urlParams = {};
    while (match = search.exec(query))
       urlParams[decode(match[1])] = decode(match[2]);
})();

/*
 * BFP section; functions used to build the BFP messages
 */ 


function BFPCreateDeviceCommandFromMem(device) {
	var message = {};
	message.header = {};
	message.header.code = BFP_DEVICE_COMMAND;
	message.body = {};
	message.body.raspyID = device.raspyID;
	message.body.ardID = device.ardID;
	message.body.devID = device.devID;
	message.body.devType = device.devType;
	message.body.dataType = device.dataType;

	if (getDeviceValue(device) == '1')
		message.header.command = BFP_LIGHTOFF;
	else 
		message.header.command = BFP_LIGHTON;

	return message;
}

function BFPCreateDeviceCommandShade(device, value, cmd) {
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
	if (cmd == BFP_SHADEUP)
		message.body.direction = 'up';
	if (cmd == BFP_SHADEDOWN)
		message.body.direction = 'down';
	
	return message;
}

function BFPCreateCloudSettings(vpnid, vpnkey, cloud) {
	var message = {};
	message.header = {};
	message.header.code = BFP_CLOUD_SETTINGS;
	message.body = {};
	message.body.cloud = cloud;
	message.body.vpnid = vpnid;
	message.body.vpnkey = vpnkey;
	
	return message;
}

function BFPCreateSyncHA() {
	let message = {};
	message.header = {};
	message.header.code = BFP_SYNC_HA;
	message.body = {};
	
	return message;
}


	  