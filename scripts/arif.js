
/* ARiF commands */
const ARIF_HEARTBEAT = 'heartbeat';
const ARIF_LIGHTON = 'lightON';
const ARIF_LIGHTOFF = 'lightOFF';
const ARIF_REGISTER = 'register';

/* default operational values */
const ARDID = '1';
const RASPYID = '001';
const RASPYIP = '192.168.254.1'

/* Debug facility initialization */
var ARIF = function() {
	this.config = require('./config.js');
	this.debug = require('./debug.js');
	this.arduino = require('./devices');
	

	/* missing heartbeats */
	this.missingHeartbeats = 3;

	/* status if raspy is aware of Ard presence */
	this.isRaspyAware = false;

	/* ardID and raspyID from raspy */
	this.ardID = ARDID;
	this.raspyID = RASPYID;
	
	/* status if we should send registration beacon */
	this.registered = false;
	
	/* status of the sync of the devices status */
	this.synced = false;

	/*setInterval(sendBeacon, 3000);
	setInterval(addMissingHeartbeat, 3000) */

	this.srcIP = null;
}

ARIF.prototype.init = function() {
	/* ARiF HTTP server */
	var app = require('express')();
	var express = require('express');
	var http = require('http');
	
	if (!this.srcIP)
		var server = http.createServer(app).listen(this.config.arif.port || 32300, onHTTPListen);
	else
		var server = http.createServer(app).listen(this.config.arif.port || 32300, this.srcIP, onHTTPListen);
	server.on('error', onHTTPError);

	app.post('*', onPostRequest);

	var dgram = require('dgram'); 
	this.BBserver = dgram.createSocket("udp4"); 
	var BBs = this.BBserver;
	if (this.srcIP) {
		this.BBserver.bind(5007, this.srcIP, function(){
			BBs.setBroadcast(true);
			BBs.setMulticastTTL(2);
			BBs.addMembership('224.1.1.1');
		});
	} else {
		this.BBserver.bind(5007, function(){
			BBs.setBroadcast(true);
			BBs.setMulticastTTL(2);
			BBs.addMembership('224.1.1.1');
		});
	}
	setInterval(sendBeacon, 3000);
	setInterval(addMissingHeartbeat, 3000)
} 

var arif = new ARIF();

/* Execute each time when HTTP POST request comes into ARiF interface */
function onPostRequest(req, res) {
	var reqDate = new Date();
	var srcIP = req.connection.remoteAddress;
	var url = req.originalUrl;
	var debug = require('./debug.js');
	
	debug.log(4, 'arif', 'Request POST URL: ' + url + ' from: ' + srcIP);
	var params = getParams(url);
	/*var devID = url.split('/')[1];
	var ardID = url.split('/')[2];
	var raspyID = url.split('/')[3];
	var command = url.split('/')[4];*/
	var devID = params.devID;
	var ardID = params.ardID;
	var raspyID = params.raspyID;
	var devType = params.devType;
	var command = params.cmd;
	debug.log(5, 'arif', 'Decoded values, devID: ' + devID + ' ardID: ' + ardID + ' raspyID: ' + raspyID + ' devType: ' + devType + ' cmd: ' + command);
	var arif = require('./arif.js');
	var arduino = require('./devices.js');
	
	switch (command) {
		case ARIF_HEARTBEAT:
			arif.missingHeartbeats = 0;
			if (ardID == arif.ardID) {
				res.writeHead(200, { 'Content-Type' : 'text/plain'});
				res.end('');
				if (arif.synced == false) {
					/* send status of all devices */
					arif.sendAllDeviceStatus();
					arif.synced = true;
				}
			} else {
				// timing out the HTTP connection because the ardID is incorrect.
				debug.log(5, 'arif', 'Received HB from incorrect ardID: ' + ardID + ' raspyID: ' + raspyID);
			}
			break;
		case ARIF_LIGHTON:
			res.writeHead(200, { 'Content-Type' : 'text/plain'});
			res.end('');
			arduino.digitOUTChangeState(devID);
			arif.sendDeviceStatus(devID, '1');
			break;
		case ARIF_LIGHTOFF:
			res.writeHead(200, { 'Content-Type' : 'text/plain'});
			res.end('');
			arduino.digitOUTChangeState(devID);
			arif.sendDeviceStatus(devID, '0'); 
			break;
		case ARIF_REGISTER:
			debug.log(5, 'arif', 'Received registration command, saving ardID: ' + ardID +
					' MAC address: ' + params.value);
			arif.ardID = ardID;
			arif.raspyID = raspyID;
			arif.registered = true;
			res.writeHead(200, { 'Content-Type' : 'text/plain'});
			res.end('');
			break;
		default:
			debug.log(4, 'arif', 'Unknown command received: ' + command);
			break;
	}
}

/* execute when ARiF HTTP server succesfully starts to listen on port */
function onHTTPListen() {
	var debug =  require('./arif.js').debug;
	var a = require('./arif.js');
	var port = a.config.arif.port || 32300;
	debug.log(1, 'arif', 'ARiF server listening on port: ' +  port + ' and IP: ' + a.srcIP);
}

/* execute when ARiF HTTP server encounters an unrecoverable error and quit the app */
function onHTTPError(err) {
	var debug =  require('./arif.js').debug;
	debug.log(1, 'arif', 'ARiF server failed: ' + err);
	process.exit(1);
}


/* send status update of a device */
ARIF.prototype.sendDeviceStatus = function(devID, status, user) {
	var http = require('http');
	var config = require('./config.js');
	var debug = this.debug;
	
	debug.log(4, 'arif', 'Sending device status to raspy: ' + RASPYIP +
		' devID: ' + devID + ' devType: ' + this.arduino.getDeviceType(devID) + ' status: ' + this.arduino.getDeviceStatus(devID));

	var devType = this.arduino.getDeviceType(devID);
	var dataType = 'bool';

	var headers = {};
	if (user) {
		headers = { 'iot-user' : 'true' };
	}

	var options = {
		hostname: RASPYIP,
		port: this.config.arif.port || 32300,
		path: '/?devID=' + devID + '&ardID=' + this.ardID + '&raspyID=' + this.raspyID + 
				'&cmd=status&devType=' + this.arduino.getDeviceType(devID) + 
				'&dataType=' + dataType + '&value=' + status,
		method: 'POST',
		agent: false,
		headers: headers
	};
	shadeID = this.arduino.getDeviceShadeID(devID);
	if (shadeID) {
		options.path = options.path + '&shadeID=' + shadeID;
	}
	
	if (this.srcIP)
		options.localAddress = this.srcIP;
	
	var req = http.request(options, function (res){
		debug.log(4, 'arif', 'Device status response STATUS: ' + res.statusCode);
	}).on('error', function(error) {
		debug.log(1, 'arif', 'failed to establish connection with the raspy: ', 
				error.message);
	});
	
	req.write('',encoding='utf8');
	req.end();

}

/* send status of all configured devices */
ARIF.prototype.sendAllDeviceStatus = function() {
	var devices = require('./devices.js');
	for (var devID in devices.devices) {
		//console.log('Sending devices status of device: ' + devID + ' status: ' + devices.getDeviceStatus(devID));
		this.sendDeviceStatus(devID, devices.getDeviceStatus(devID));
	}
}

function getParams(url) {
	var urlParams;
    var match,
        pl     = /\+/g,  // Regex for replacing addition symbol with a space
        search = /([^&?\/=]+)=?([^&]*)/g,
        decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); };

    urlParams = {};
    while (match = search.exec(url))
       urlParams[decode(match[1])] = decode(match[2]);
	
	return urlParams
}

/* increment missing Heartbeat timer regularly */
function addMissingHeartbeat() {
	arif = require('./arif.js');
	if (arif.missingHeartbeats <= 3)
		arif.missingHeartbeats += 1;
}

/* send beacon */
function sendBeacon() {
	var arif = require('./arif.js')
	if (!arif.registered)
		var url = '/smarthouse/0';
	else
		var url = '/smarthouse/' + arif.ardID;
    var message = new Buffer(url);

	if (arif.missingHeartbeats >= 3 || arif.register) {
		arif.BBserver.send(message, 0, message.length, 5007, '224.1.1.1');
		arif.debug.log(5, 'arif', 'Sent URL: ' + message + ' beacon');
		arif.synced = false;
	}
    //server.close();
}

/* set registration flag */
ARIF.prototype.setRegisterFlag = function(flag) {
	this.registered = flag;
}

ARIF.prototype.setSourceIP = function(srcIP) {
	this.srcIP = srcIP;
}

module.exports = arif;
