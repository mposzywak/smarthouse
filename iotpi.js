
/*
 * IoT application for gathering data over HTTP
 *
 *
 */

/* load the config file */
var config = require('./config.js');
var debug = require('./debug.js');
var bfp = require('./bfp.js');
var init = require('./init.js');
init.setInit('main');


var debug = require('./debug.js').enableDebugServer();
var mem = require('./mem.js');

var backend, rcp, app, express, http, server, arif, mqtt;

mem.initialize(function(error) {
	if (error != null) {
		debug.log(1, 'arif', 'Closing application. Could not initialize mem structure: ' + error);
		process.exit(1);
	}

	backend = require('./backend.js');
	rcp = require('./rcpserver.js');
	mqtt = require('./mqtt.js');

	/* ARiF HTTP server */
	if (!config.cloud.enabled) {
		init.setInit('ARiF');
		app = require('express')();
		express = require('express');
		http = require('http');
		server = http.createServer(app).listen(config.arif.port || 32300, onHTTPListen);
		server.on('error', onHTTPError);

		arif = require('./arif.js');
		app.use(express.json());
		app.post('/*', onPostRequest);
	}
	/* multicast server setup for BB */
	//const dgram = require('dgram');
	//const BBSocket = dgram.createSocket('udp4');

	init.setCallback(onInitComplete);
	init.clearInit('main');
	/* end of all initialization actions */

	/* handle VPN connection on startup */
	/*if (!config.cloud.enabled) {
		getVPNConnectedStatus();
	}*/

});





/* ARIF commands */
const ARIF_REGISTER  = 'a';
const ARIF_LIGHT_ON  = '1';
const ARIF_LIGHT_OFF = '2';
const ARIF_DEV_STATUS = 'status';
const ARIF_DEV_MAPPING = '32';
const ARIF_DEV_STATUS_DIR = 'statusDIR';
const ARIF_DEV_STATUS_POS = 'statusPOS';
const ARIF_DEV_STATUS_TILT = 'statusTILT';
const ARIF_ARD_CTRL_ON = 'ctrlON';
const ARIF_ARD_CTRL_OFF = 'ctrlOFF';
const ARIF_ARD_SETTINGS = 'settings';
const ARIF_DEV_LIGHT_INPUT_TYPE = 'lightInputType';
const ARIF_DEV_LIGHT_TYPE = 'lightType';
const ARIF_DEV_LIGHT_SETTINGS = 'lightSettings';

//app.use(express.static('smarthouse'))

/* Execute each time when HTTP POST request comes into ARiF interface */
function onPostRequest(req, res) {
	var reqDate = new Date().getTime();
	let srcIP = req.connection.remoteAddress;
	debug.log(4, 'arif', 'Request POST URL: ' + req.originalUrl + ' from: ' + srcIP);
	//console.log(req.connection.remoteAddress);
	//console.log(req.socket.remoteAddress);
	//console.log(req.ip);

	if (!config.cloud.id) {
		debug.log(1, 'arif', 'Sending 502: ARIF interface not enabled, system configured for cloud');
		res.writeHead(502, { 'Content-Type' : 'text/plain'});
        res.end('Error: probably wrong URL');
		return;
	}
	
	var url = req.originalUrl;
	var params = getParams(url);
	
	var devID = req.query.devID; 
	var ardID = params.ardID; 
	var raspyID = params.raspyID; 
	var cmd = params.cmd; 

	
	if (devID && ardID && raspyID && cmd && url.length < 256) {
		//debug.log(5, 'arif', 'URL match result: ' + result + ' command: ' + command);
		if (raspyID != require('./config.js').rcpclient.vpnID.split('-')[1]) {
			debug.log(1, 'arif', 'Sending 403: ARIF received raspyID different from the one configured!');
			res.writeHead(403, { 'Content-Type' : 'text/plain'});
        	res.end('Error: incorrect raspyID');
			return;
		}
		if (devID == '0') {
			switch (cmd) {
				case ARIF_ARD_CTRL_ON:
					var BFPCtrlON = bfp.BFPCreateCtrlONEnabled(ardID, raspyID);
					mem.setCtrlON(config.cloud.id, BFPCtrlON);
					break;
				case ARIF_ARD_CTRL_OFF:
					var BFPCtrlON = bfp.BFPCreateCtrlONDisabled(ardID, raspyID);
					mem.setCtrlON(config.cloud.id, BFPCtrlON);
					break;
				case ARIF_ARD_SETTINGS:
					debug.log(5, 'arif', 'settings received from: ' + srcIP + ', data: ' + JSON.stringify(req.body));				
					var BFPSettings = bfp.BFPCreateSettings(ardID, raspyID, req.body.version, req.body.mode, req.body.ctrlON, req.body.uptime, req.body.restore);
					mem.setSettings(config.cloud.id, BFPSettings);
					break;
				default:
					debug.log(1, 'arif', 'command on ardID 0: ' + cmd + ' from: ' + srcIP + ' is unknown!');	
			}
		} else {
			switch (cmd) {
				case ARIF_REGISTER:
					var newArdID = mem.registerArduino(config.cloud.id, srcIP);
					res.set('X-arduino', newArdID);
					break;
				case ARIF_DEV_STATUS:
					var devType = params.devType; // url.split('/')[5];
					var dataType = params.dataType; //url.split('/')[6];
					var value = params.value; //url.split('/')[7];
					var userIndicaitonHeader = false;
					if (req.get('iot-user') == 'true') {
						userIndicaitonHeader = true;
					}
				
					if (arif.validateDeviceStatusData(devID, ardID, raspyID, devType, dataType, value, srcIP)) {
						var BFPDeviceStatus = bfp.BFPCreateDeviceStatus(devID, ardID, raspyID, devType, dataType, value, reqDate, srcIP, userIndicaitonHeader);
						mem.setDeviceStatus(config.cloud.id, BFPDeviceStatus);
					} else {
					
						debug.log(2, 'arif', 'Sending 404, improper URL or IP received: ' + url + ' from: ' + srcIP);
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
					mem.setDevice(config.cloud.id, devid, ardid, devType, reqDate, srcIP, controlledDevs)
					break;
				case ARIF_DEV_STATUS_DIR:
					var devType = params.devType; // url.split('/')[5];
					var dataType = params.dataType; //url.split('/')[6];
					var value = params.value; //url.split('/')[7];
					var userIndicaitonHeader = false;
					if (req.get('iot-user') == 'true')
						userIndicaitonHeader = true;
				
					if (arif.validateDeviceStatusData(devID, ardID, raspyID, devType, dataType, value, srcIP)) {
						var BFPDeviceStatus = bfp.BFPCreateDeviceStatus(devID, ardID, raspyID, devType, dataType, value, reqDate, srcIP, userIndicaitonHeader);
						mem.setDeviceStatus(config.cloud.id, BFPDeviceStatus);
					} else {
						debug.log(2, 'arif', 'Sending 404, improper URL or IP received: ' + url + ' from: ' + srcIP);
						res.writeHead(404, { 'Content-Type' : 'text/plain'});
						res.end('Error: probably wrong URL');
						return;
					}
					break;
				case ARIF_DEV_LIGHT_INPUT_TYPE:
					var value = params.value;
					var BFPLightInputType = bfp.BFPCreateLightInputType(devID, ardID, raspyID, value);
					mem.setLightInputType(config.cloud.id, BFPLightInputType);
					break;
				case ARIF_DEV_LIGHT_TYPE:
					var value = params.value;
					var BFPLightType = bfp.BFPCreateLightType(devID, ardID, raspyID, value);
					mem.setLightType(config.cloud.id, BFPLightType);
					break;
				case ARIF_DEV_LIGHT_SETTINGS:
					debug.log(5, 'arif', 'Light settings received from: ' + srcIP + ' of: ' + devID + ', data: ' + JSON.stringify(req.body));
					//var BFPLightInputType = bfp.BFPCreateLightInputType(devID, ardID, raspyID, req.body.lightInputType);
					//var BFPLightType = bfp.BFPCreateLightType(devID, ardID, raspyID, req.body.lightType);
					//var BFPLightCtrlON = bfp.BFPCreateLightCtrlON(devID, ardID, raspyID, req.body.ctrlON);
					var BFPLightSettings = bfp.BFPCreateLightSettings(devID, ardID, raspyID, req.body.lightType, req.body.lightInputType, req.body.ctrlON, req.body.timer);
					mem.setLightSettings(config.cloud.id, BFPLightSettings);
					//mem.setLightType(config.cloud.id, BFPLightType);
					//mem.setLightCtrlON(config.cloud.id, BFPLightCtrlON);
					break;
				case ARIF_DEV_STATUS_POS:
					break;
				case ARIF_DEV_STATUS_TILT:
					break;
				default:
					debug.log(1, 'arif', 'command: ' + cmd + ' from: ' + srcIP + ' is unknown!');
			}
		}
		debug.log(4, 'arif', 'Sending 200 OK to: ' + srcIP + ' for GET URL: ' + url);
		res.writeHead(200, { 'Content-Type' : 'text/plain'});
        res.end('Data ack');
	} else {
		if (url == '/vpn/up') {
			let mem = require('./mem.js');
			debug.log(2, 'arif', 'Received VPN UP indication from: ' + srcIP);
			
			if (mem.getInitSetupFlag() && mem.getVpnKeyReceivedFlag() != true) {
				/* initial connection with the initVPNKey */
				require('./mem.js').requestVPNKey();
			}
			if (mem.getInitSetupFlag() && mem.getVpnKeyReceivedFlag()) {
				/* first connection with the vpnKey just obtained from the cloud */
				mem.setInitSetupFlag(false);
				mem.setVPNStateUP();
				mem.setVPNLastError('VPN_NOERROR');
				mem.sendCloudStatus();
				require('./os.js').sendPublicKey();
			}
			let isf = mem.getInitSetupFlag();
			if (isf == false || typeof(isf) == 'undefined') {
				/* all subsequent connections with the vpnKey */
				mem.setVPNStateUP();
				mem.setVPNLastError('VPN_NOERROR');
				mem.sendCloudStatus();
			}
			res.writeHead(200, { 'Content-Type' : 'text/plain'});
	        res.end();
			return;
		}
		if (url == '/vpn/down') {
			debug.log(2, 'arif', 'Received VPN DOWN indication from: ' + srcIP);
			if (mem.getInitSetupFlag()) {
				debug.log(5, 'os', 'VPN DOWN Event due to VPN initial setup in progress.');
				res.writeHead(200, { 'Content-Type' : 'text/plain'});
		        res.end();
				return;
			}
			require('./mem.js').setVPNStateDOWN();
			require('./os.js').getLastVPNError(function(error, code) {
				debug.log(1, 'os', 'On VPN DOWN Event - Error found in the log: ' + code);
				require('./mem.js').setVPNLastError(code);
				require('./mem.js').sendCloudStatus();
			});
			res.writeHead(200, { 'Content-Type' : 'text/plain'});
	        res.end();
			return;
		}
		debug.log(2, 'arif', 'Sending 404, improper URL received: ' + url + ' from: ' + srcIP);
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

function getParams(url) {
	var urlParams;
    var match,
        pl     = /\+/g,  // Regex for replacing addition symbol with a space
        search = /([^&=]+)=?([^&]*)/g,
        decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); };

    urlParams = {};
    while (match = search.exec(url))
       urlParams[decode(match[1])] = decode(match[2]);
	
	return urlParams
}
