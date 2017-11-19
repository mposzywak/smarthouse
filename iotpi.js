
/*
 * IoT application for gathering data over HTTP
 *
 *
 */

/* load the config file */
var config = require('./config.js');
var debug = require('./debug.js')

var init = require('./init.js');
init.setInit('main');


var debug = require('./debug.js').enableDebugServer();
var mem = require('./mem.js');
var backend = require('./backend.js');
var rcp = require('./rcpserver.js');

/* ARiF HTTP server */
init.setInit('ARiF');
var app = require('express')();
var express = require('express');
var http = require('http');
var server = http.createServer(app).listen(config.arif.port || 32300, onHTTPListen);
server.on('error', onHTTPError);

var arif = require('./arif.js');

/* multicast server setup for BB */
const dgram = require('dgram');
const BBSocket = dgram.createSocket('udp4');

BBSocket.on('error', (err) => {
  console.log(`BBSocket error:\n${err.stack}`);
  BBSocket.close();
});

BBSocket.on('message', (msg, rinfo) => {
  console.log(`BBSocket got: ${msg} from ${rinfo.address}:${rinfo.port}`);
});

BBSocket.on('listening', () => {
  const address = BBSocket.address();
  BBSocket.addMembership('224.1.1.1');
  console.log(`BBSocket listening ${address.address}:${address.port}`);
});

BBSocket.bind('5007');

init.setCallback(onInitComplete);
init.clearInit('main');
/* end of all initialization actions */




/* ARIF commands */
const ARIF_REGISTER  = 'a';
const ARIF_LIGHT_ON  = '1';
const ARIF_LIGHT_OFF = '2';
const ARIF_DATA_TRANSFER = '40';
const ARIF_DEV_MAPPING = '32';

/* accept requests for all URLs, filter later */
app.post('/*', onPostRequest);
//app.use(express.static('smarthouse'))

/* Execute each time when HTTP POST request comes into ARiF interface */
function onPostRequest(req, res) {
	var reqDate = new Date();
	srcip = req.connection.remoteAddress;
	debug.log(4, 'arif', 'Request POST URL: ' + req.originalUrl + ' from: ' + srcip);

	if (!config.cloud.id) {
		debug.log(1, 'arif', 'Sending 502: ARIF interface not enabled, system configured for cloud');
		res.writeHead(502, { 'Content-Type' : 'text/plain'});
        res.end('Error: probably wrong URL');
		return;
	}
	
	var url = req.originalUrl;
	var result = url.match("^(\/[0-9a-fA-F]{1,2}){3}");
	var devid = url.split('/')[1];
	var ardid = url.split('/')[2];
	var command = url.split('/')[3];
	if (result && url.length < 64 && devid != '0') {
		
		//debug.log(5, 'arif', 'URL match result: ' + result + ' command: ' + command);
		switch (command) {
			case ARIF_REGISTER:
				var ardid = mem.registerArduino(config.cloud.id, srcip);
				res.set('X-arduino', ardid);
				break;
			case ARIF_DATA_TRANSFER:
				var devType = url.split('/')[4];
				var dataType = url.split('/')[5];
				var value = url.split('/')[6];
				if (arif.validateDataTransferURL(url, srcip))
					mem.setDeviceStatus(config.cloud.id, devid, ardid, devType, dataType, value, reqDate, srcip);
				else {
					debug.log(2, 'arif', 'Sending 404, improper URL or IP received: ' + url + ' from: ' + srcip);
					res.writeHead(404, { 'Content-Type' : 'text/plain'});
					res.end('Error: probably wrong URL');
					return;
				}
				break;
			case ARIF_DEV_MAPPING:
				devType = validateDevType(url.split('/')[4]);
				dataType = validateDataType(url.split('/')[5]);
				controlledDevs = url.split('/').slice(5); // get rest of array from 5th element
				console.log(controlledDevs);
				mem.setDevice(config.cloud.id, devid, ardid, devType, reqDate, srcip, controlledDevs)
				break;
			default:
				debug.log(1, 'arif', 'command: ' + command + ' from: ' + srcip + ' is unknown!');
		}
		debug.log(4, 'arif', 'Sending 200 OK to: ' + srcip + ' for GET URL: ' + url);
		res.writeHead(200, { 'Content-Type' : 'text/plain'});
        res.end('Data ack');
	} else {
		debug.log(2, 'arif', 'Sending 404, improper URL received: ' + url + ' from: ' + srcip);
		res.writeHead(404, { 'Content-Type' : 'text/plain'});
        res.end('Error: probably wrong URL');
	}
}

function validateDevType(devType) {
	return devType;
}

function validateDataType(dataType) {
	return dataType
}

function validateValue(value) {
	return value;
}

/* execute when ARiF HTTP server succesfully starts to listen on port */
function onHTTPListen() {
	debug.log(1, 'arif', 'ARiF server listening on port: ' +  config.arif.port || 32300);
	require('./components.js').getFacility('init').clearInit('ARiF');
}

/* execute when ARiF HTTP server encounters an unrecoverable error and quit the app */
function onHTTPError(err) {
	debug.log(1, 'arif', 'ARiF server failed: ' + err);
	process.exit(1);
}

/* call this when all intialisation procedures have been completed */
function onInitComplete() {
	debug.log(1, 'init', 'Finished all initialization tasks');
	debug.log(1, 'security', 'TODO: calling privs drop');
	if (config.cloud.enabled) {
		debug.log(1, 'init', 'app initialized as cloud');
	} else {
		debug.log(1, 'init', 'app initialized as raspby');
	}
}