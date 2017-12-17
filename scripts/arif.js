
/* ARiF commands */
const ARIF_HEARTBEAT = 'heartbeat';
const ARIF_LIGHTON = 'lightON';
const ARIF_LIGHTOFF = 'lightOFF';

/* default operational values */
const ARDID = '1';
const RASPYID = '001';
const RASPYIP = '192.168.254.1'

/* Debug facility initialization */
var ARIF = function() {
	this.config = require('./config.js');
	this.debug = require('./debug.js');
	this.arduino = require('./devices');
	
	/* ARiF HTTP server */
	var app = require('express')();
	var express = require('express');
	var http = require('http');
	var server = http.createServer(app).listen(this.config.arif.port || 32300, onHTTPListen);
	server.on('error', onHTTPError);

	app.post('*', onPostRequest);

	var dgram = require('dgram'); 
	this.BBserver = dgram.createSocket("udp4"); 
	var BBs = this.BBserver;
	this.BBserver.bind(5007, function(){
		BBs.setBroadcast(true);
		BBs.setMulticastTTL(2);
		BBs.addMembership('224.1.1.1');
	});

	/* missing heartbeats */
	this.missingHeartbeats = 3;

	/* status if raspy seems to be aware of Ard presence */
	this.isRaspyAware = false;

	/* ardID from raspy */
	this.ardID = ARDID;

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
	
	var arif = require('./arif.js');
	var arduino = require('./devices.js');
	
	switch (command) {
		case ARIF_HEARTBEAT:
			missingHeartbeats = 0;
			res.writeHead(200, { 'Content-Type' : 'text/plain'});
			res.end('');
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
		default:
			debug.log(4, 'arif', 'Unknown command received: ' + command);
			break;
	}
}

/* execute when ARiF HTTP server succesfully starts to listen on port */
function onHTTPListen() {
	var debug =  require('./arif.js').debug;
	debug.log(1, 'arif', 'ARiF server listening on port: ' +  require('./arif.js').config.arif.port || 32300);
}

/* execute when ARiF HTTP server encounters an unrecoverable error and quit the app */
function onHTTPError(err) {
	var debug =  require('./arif.js').debug;
	debug.log(1, 'arif', 'ARiF server failed: ' + err);
	process.exit(1);
}


/* send status update of a device */
ARIF.prototype.sendDeviceStatus = function(devID, status) {
	var http = require('http');
	var config = require('./config.js');
	var debug = this.debug;
	
	debug.log(4, 'arif', 'Sending device status to raspy: ' + RASPYIP +
		' devID: ' + devID + ' devType: ' + this.arduino.getDeviceType(devID) + ' status: ' + this.arduino.getDeviceStatus(devID));

	var devType = this.arduino.getDeviceType(devID);
	var dataType = 'bool';
	var options = {
		hostname: RASPYIP,
		port: this.config.arif.port || 32300,
		path: '/?devID=' + devID + '&ardID=' + ARDID + '&raspyID=' + RASPYID + 
				'&cmd=status&devType=' + this.arduino.getDeviceType(devID) + 
				'&dataType=' + dataType + '&value=' + status,
		method: 'POST',
		agent: false,
		headers: {}
	};
	
	var req = http.request(options, function (res){
		debug.log(4, 'arif', 'Device status response STATUS: ' + res.statusCode);
	}).on('error', function(error) {
		debug.log(1, 'arif', 'failed to establish connection with the raspy: ', 
				error.message);
	});
	
	req.write('',encoding='utf8');
	req.end();

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

/* increment missing Heartbeat timer regularly */
function addMissingHeartbeat() {
	arif = require('./arif.js');
	if (arif.missingHeartbeats <= 3)
		arif.missingHeartbeats += 1;
}

/* send beacon */
function sendBeacon() {
	var arif = require('./arif.js')
	var url = '/smarthouse/' + arif.ardID;
    var message = new Buffer(url);
	var arif = require('./arif.js');
	if (arif.missingHeartbeats >= 3) {
		arif.BBserver.send(message, 0, message.length, 5007, '224.1.1.1');
		arif.debug.log(5, 'arif', 'Sent URL: ' + message + ' beacon');
	}
    //server.close();
}



module.exports = arif;
