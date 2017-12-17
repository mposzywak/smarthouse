
/* load the config file */
var config = require('./config.js');
var debug = require('./debug.js');
var arif = require('./arif.js');
/* ARiF HTTP server */
/*var app = require('express')();
var express = require('express');
var http = require('http');
var server = http.createServer(app).listen(config.arif.port || 32300, onHTTPListen);
server.on('error', onHTTPError);*/

var arduino = require('./devices.js');

/* ARiF commands */
const ARIF_HEARTBEAT = 'heartbeat';
const ARIF_LIGHTON = 'lightON';
const ARIF_LIGHTOFF = 'lightOFF';

/* default operational values */
const ARDID = '1';
const RASPYID = '001';
const RASPYIP = '192.168.254.1'
/*  */

/* create readline interface for interactive CLI */
var readline = require('readline');
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', onInput)

function onInput(line) {
	cmd = line.split(' ')[0]
	switch (cmd) {
		case 'help':
			printHelp();
			break;
		case 'show':
			showDevices(line);
			break;
		case 'toggle':
			toggleDevice(line);
			break;
		case 'exit':
			process.exit(0);
			break;
		default:
			console.log('unknown command: ' + cmd)
			break;
	}
}

function printHelp() {
	console.log(' ----== Commands ==---- \n\n');
	console.log(' help - \t\t\t print this help');
	console.log(' show - \t\t\t list all devices available');
	console.log(' toggle <devID> - \t\t toggle digital IN device');
	console.log(' exit - \t\t\t close program');
	console.log('\n\n');
}

function showDevices(line) {
	arduino.showDevices();
}

function toggleDevice(line) {
	var devID = line.split(' ')[1];
	var arif = require('./arif.js');
	var arduino = require('./devices.js');
	
	arduino.toggle(devID);
		//arif.sendDeviceStatus(devID, ARDID, RASPYID, RASPYIP, 'digitOUT', arduino.getDeviceStatus(devID));
	
}

/* send beacon */
function sendBeacon() {
	var url = '/smarthouse/' + ardID;
    var message = new Buffer(url);
	if (missingHeartbeats >= 3) {
		server.send(message, 0, message.length, 5007, '224.1.1.1');
		debug.log(5, 'arif', 'Sent URL: ' + message + ' beacon');
	}
    //server.close();
}

