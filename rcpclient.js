var RCPClient = function () {
	
	this.config = require('./config.js');
	this.debug = require('./debug.js')
	this.components = require('./components').setFacility(this, 'rcpclient');
	
	this.isCloudAlive = false;
	this.lastResponseCode = null;
	
	// Create HTTP client
	///this.http = require('http');
	//this.rcpserver = http.createClient(this.config.cloud.host, this.config.cloud.port);

	setInterval(sendHeartbeat, 3000);

}

var rcpclient = new RCPClient();

function sendHeartbeat() {
	var url = '/heartbeat';
	var payload = null;
	var rcpclient = require('./rcpclient.js');
	var debug = require('./debug.js');

	debug.log(5, 'rcpclient', 'Sending hearbeat to cloud server.');
	rcpclient.sendMessage(url, payload, function(error, res) {
		if (res) {
			if (res.statusCode == 200 && rcpclient.isCloudAlive == false) {
				rcpclient.isCloudAlive = true;
				rcpclient.sendBFPCloudStatus(res.statusCode);
				debug.log(1, 'rcpclient', 'Setting Cloud connection alive. Sending Device status');
				// Send status of all alive devices to the Cloud
				require('./mem.js').sendRCPAllDeviceStatus(require('./rcpclient.js'));
			} else if (res.statusCode != 200) {
				debug.log(1, 'rcpclient', 'Incorrect StatusCode received on RCP from Cloud Server!');
			}
		} else {
			debug.log(1, 'rcpclient', 'Could not send heartbeat message: ' + error.message);
			if (rcpclient.isCloudAlive) {
				rcpclient.isCloudAlive = false;
				rcpclient.sendBFPCloudStatus(null);
			}
		}
	});
}

/**
 * send Arduino Alive message over RCP
 */
RCPClient.prototype.sendArduinoAlive = function(ardID) {
	var debug = require('./debug.js');

	if (this.isCloudAlive == false) {
		debug.log(1, 'rcpclient', 'Setting Cloud connection dead. Not sending Arduino-Alive messages');
		return;
	}

	var url = '/arduino-alive?ardID=' + ardID;
	
	debug.log(4, 'rcpclient', 'Sending arduino-alive, ardID: ' + ardID);
	
	this.sendMessage(url, null, function(error, res) {
		if (res)
			debug.log(4, 'rcpclient', 'Received STATUS: ' + res.statusCode + ' to arduino-alive');
		if (error)
			debug.log(1, 'rcpclient', 'Failed to send arduino-alive: ' + error.message);
			//require('./rcpclient.js').isCloudAlive = false;
	});
}

/**
 * send Arduino Dead message over RCP
 */ 
RCPClient.prototype.sendArduinoDead = function(ardID) {
	var debug = require('./debug.js');

	if (this.isCloudAlive == false) {
		debug.log(1, 'rcpclient', 'Setting Cloud connection dead. Not sending Arduino-Dead messages');
		return;
	}

	var url = '/arduino-dead?ardID=' + ardID;
	
	debug.log(4, 'rcpclient', 'Sending arduino-dead, ardID: ' + ardID);
	
	this.sendMessage(url, null, function(error, res) {
		if (res)
			debug.log(4, 'rcpclient', 'Received STATUS: ' + res.statusCode + ' to arduino-dead');
		if (error)
			debug.log(1, 'rcpclient', 'Failed to send arduino-dead: ' + error.message);
			//require('./rcpclient.js').isCloudAlive = false;
	});
}


/** Send generic message on RCP 
 * put URL, payload has to be a JSON argument, if set to NULL or '' body will be sent empty
 * callback has the following arguments: callback(error, res)
 */
RCPClient.prototype.sendMessage = function(url, payload, callback) {
	var http = require('http');
	var debug = require('./debug.js');
	var config = this.config;
	
	var db = require('./configdb.js');
	db.getVpnID('admin', function(error, vpnID, vpnKey) {
		if (error) {
			debug.log(1, 'rcpclient', 'Failed to obtain vpnID and vpnKey from DB: ' + error.message)
		} else {
			//console.log('vpnID: ' + vpnID + ' vpnKey: ' + vpnKey);
	
			var options = {
				hostname: config.rcpclient.host,
				port: config.rcpclient.port,
				path: url,
				method: 'POST',
				agent: false,
				headers: {
					'iot-raspyid' : vpnID, 
					'iot-vpnkey' : vpnKey,
					'Content-Type' : 'application/json'
				}
			};

			var req = http.request(options, function (res){
			callback(null, res);
			}).on('error', function(error) {
				callback(error, null);
			});
	
			if (payload)
				req.write(JSON.stringify(payload), encoding='utf8');
			else
				req.write('', encoding='utf8');
	
			req.end();
		}
	});
}

/**
 * Send generic Uplink message on RCP ()
 */
RCPClient.prototype.sendUplinkMessage = function(payload) {
	var url = '/uplink';
	var rcpclient = require('./rcpclient.js');
	var debug = require('./debug.js');

	if (this.isCloudAlive == false) {
		debug.log(1, 'rcpclient', 'Setting Cloud connection dead. Not sending Uplink messages');
		return;
	}

	debug.log(5, 'rcpclient', 'Sending hearbeat to cloud server.');
	this.sendMessage(url, payload, function(error, res) {
		if (res) {
			if (res.statusCode == 200) {
				if (payload.header)
					payloadCode = payload.header.code;
				else
					payloadCode = 'Unknown header.code';

				debug.log(4, 'rcpclient', 'Status 200 received as a response to Uplink message: ' + payloadCode);
			} else if (res.statusCode != 200) {
				debug.log(1, 'rcpclient', 'Incorrect StatusCode received on RCP Uplink from Cloud Server, code: ' + res.statusCode);
			}
		} else {
			debug.log(1, 'rcpclient', 'Could not send Uplink message: ' + error.message);
		}
	});
}

/**
 * function that sends the current cloud status to the Front-End via BFP
 */
RCPClient.prototype.sendBFPCloudStatus = function(response) {
	var io = require('./backend.js').io;
	var config = require('./config.js');
	var debug = require('./debug.js');
	var host;
	var port;
	var vpnID;
	var BFPCloudStatus;

	if (config.cloud.connection) {
		status = this.isCloudAlive;
		host = config.rcpclient.host;
		port = config.rcpclient.port;
		vpnID = config.rcpclient.vpnID;
		BFPCloudStatus = require('./bfp.js').BFPCreateCloudStatus(true, status, host, port, vpnID, response);
	} else {
		BFPCloudStatus = require('./bfp.js').BFPCreateCloudStatus(false);
	}
	
	io.of('/iot').to(config.cloud.id).emit('cloud_status', BFPCloudStatus);
	debug.log(4, 'rcpclient', 'Emitting cloud status message: ' + JSON.stringify(BFPCloudStatus));
}

module.exports = rcpclient;
