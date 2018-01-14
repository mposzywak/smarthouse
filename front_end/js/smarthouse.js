
/* BFP (Backend Frontend Protocol) commands */
const BFP_HEARTBEAT = 'heartbeat';
const BFP_LIGHTON = 'lightON';
const BFP_LIGHTOFF = 'lightOFF';

/* command send status */
const COMMAND_ON = 1;
const COMMAND_CLEAR = 0;

/* devTypes */
const TYPE_DIGITIN = 'digitIN';
const TYPE_DIGITOUT = 'digitOUT';

/* consts for message codes */
const MSG_ARDUINO_DEAD = 0;
const MSG_ARDUINO_ALIVE = 1;
 

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


function onLightButton(device) {
	var buttonID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_button';
	var iconID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_icon';
	$('#' + buttonID).removeAttr("disabled", "disabled");
	$('#' + buttonID).removeClass('switch-button-off');
	$('#' + buttonID).removeClass('switch-button-error');
	$('#' + buttonID).addClass('switch-button-on');
	$('#' + buttonID).addClass('text-white');
	$('#' + buttonID).html('<span class="fa fa-lightbulb-o" aria-hidden="true" id="' + iconID + '"></span> On');
}

function offLightButton(device) {
	var buttonID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_button';
	var iconID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_icon';
	$('#' + buttonID).removeAttr("disabled", "disabled");
	$('#' + buttonID).removeClass('switch-button-on');
	$('#' + buttonID).removeClass('switch-button-error');
	$('#' + buttonID).removeClass('text-white');
	$('#' + buttonID).addClass('switch-button-off');
	$('#' + buttonID).html('Off');
}

function errorLightButton(device) {
	var buttonID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_button';
	var iconID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_icon';
	$('#' + buttonID).removeClass('switch-button-on');
	$('#' + buttonID).removeClass('switch-button-off');
	$('#' + buttonID).removeClass('text-white');
	$('#' + buttonID).addClass('switch-button-error');
	$('#' + buttonID).attr("disabled", "disabled");
	$('#' + buttonID).html('<span class="fa fa-exclamation-circle" aria-hidden="true" id="' + iconID + '"></span> Disabled');
	
}

function disableLightButton(device) {
	var buttonID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_button';
	$('#' + buttonID).attr("disabled", "disabled");
	$('#' + buttonID).text('working...');
}

function enableLightButton(device) {
	var buttonID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_button';
	var iconID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_icon';
	var value = devices[device.raspyID][device.ardID][device.devID].value;
	
	$('#' + buttonID).removeAttr("disabled");
	$('#' + buttonID).removeClass('switch-button-error');
	
	if (value == '0') {
		$('#' + buttonID).addClass('switch-button-off');
		$('#' + buttonID).text('Off');
	} else {
		$('#' + buttonID).addClass('switch-button-on');
		$('#' + buttonID).html('<span class="fa fa-lightbulb-o" aria-hidden="true" id="' + iconID + '"></span> On');
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
		onError('Timeout while waiting for device status: ' + getDeviceDesc(device) + ' (3)');
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
/* Message displaying section */

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
}

/* executed each time there is a failure during WS connection to the back end */
function onConnect() {
	if (WSConnection == CONNECTION_ERROR) {
		removeMsg();
		displaySuccessMsg('Connection to the cloud established succesfully.');
		WSConnection = CONNECTION_EXISTS;
	}
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
	  