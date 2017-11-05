
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

/* regex for verification of the incoming URL on ARiF */
var urlRegex = '(\/[0-9a-fA-F]{1,4}){2}';
urlRegex += '\/(data|req)';						// commands: data, req
urlRegex += '\/(i2c|1wire)\/(';					// devTypes: i2c, 1wire 
urlRegex += '16bit\/[0-9a-fA-F]{1,4}\\b|'; 		// 16bit value 0 - FFFF
urlRegex += 'dec\/[0-9]{1,7}\\b|'				// 32bit value 0 - FFFFFFFF
urlRegex += '32bit\/[0-9a-fA-F]{1,8}\\b)';		// dec   value 0 - 99999999

/* accept requests for all URLs, filter later */
//app.get('/*', onGetRequest);
app.post('/*', onPostRequest);
//app.use(express.static('smarthouse'))

/* Executed each time when an HTTP request comes into ARiF interface */
/*function onGetRequest(req, res) { ##################### TODO: Remove the function as we use POST.
	reqDate = new Date();
	debug.log(4, 'arif', 'Request GET URL: ' + req.originalUrl + ' from: ' + req.connection.remoteAddress);
	var result = req.originalUrl.match(urlRegex);
	
	if (result) {
		debug.log(5, 'arif', 'URL match result: ' + result + ' command: ' + result[2]);
		if (result[2] == 'data') { // if command is data put it into the mem cache, db etc...
			mem.setDeviceStatus(config.cloud.id, req.originalUrl, reqDate, req.connection.remoteAddress);
		}
		debug.log(4, 'arif', 'Sending 200 OK to: ' + req.connection.remoteAddress + ' for GET URL: ' + req.originalUrl);
		res.writeHead(200, { 'Content-Type' : 'text/plain'});
        res.end('Data ack');
	} else {
		debug.log(1, 'arif', 'Sending 404, improper URL received: ' + req.originalUrl + ' from: ' + req.connection.remoteAddress);
		res.writeHead(404, { 'Content-Type' : 'text/plain'});
        res.end('Error: probably wrong URL');
	}
}*/

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
	if (result && url.length < 64) {
		var devid = url.split('/')[1];
		var ardid = url.split('/')[2];
		var command = url.split('/')[3];
		
		//debug.log(5, 'arif', 'URL match result: ' + result + ' command: ' + command);
		switch (command) {
			case ARIF_REGISTER:
				var ardid = mem.registerArduino(config.cloud.id, srcip);
				res.set('X-arduino', ardid);
				break;
			case ARIF_DATA_TRANSFER:
				devType = validateDevType(url.split('/')[4]);
				dataType = validateDataType(url.split('/')[5]);
				value = validateValue(url.split('/')[6]);
				mem.setDeviceStatus(config.cloud.id, devid, ardid, devType, dataType, value, reqDate, srcip);
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
		debug.log(1, 'arif', 'Sending 404, improper URL received: ' + url + ' from: ' + srcip);
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