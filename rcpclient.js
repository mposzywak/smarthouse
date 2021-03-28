var RCPClient = function () {
	
	this.config = require('./config.js');
	this.debug = require('./debug.js')
	this.components = require('./components').setFacility(this, 'rcpclient');
	
	this.isCloudAlive = false;
	this.lastResponseCode = null;
	
	let mem = require('./mem.js');
	let raspyID = require('./config.js').rcpclient.vpnID.split('-')[1];
	let devices = mem.getClientDevices('admin');
	let raspy = devices.raspys[raspyID];

	setInterval(function() {
		sendHeartbeat();
	}, 3000);

}

var rcpclient = new RCPClient();

function sendHeartbeat() {
	var url = '/heartbeat';
	var payload = null;
	var rcpclient = require('./rcpclient.js');
	var debug = require('./debug.js');

	let mem = require('./mem.js');
	let raspyID = require('./config.js').rcpclient.vpnID.split('-')[1];
	let devices = mem.getClientDevices('admin');
	let raspy = devices.raspys[raspyID];
	
	if (!raspy.cloud) {
		if (raspy.VPNConnected != true)
			return;
	}

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
				debug.log(1, 'rcpclient', 'Incorrect StatusCode to heartbeat on RCP from Cloud Server:' + res.statusCode);
			} else {
				debug.log(1, 'rcpclient', 'Received StatusCode to heartbeat on RCP from Cloud Server:' + res.statusCode)
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

/**
 * Send the request for new VPNkey
 */ 
RCPClient.prototype.requestVPNKey = function(callback) {
	let debug = require('./debug.js');
	let mem = require('./mem.js');
	
	let url = '/request-vpnkey';

	this.sendMessage(url, null, function(error, res) {
		if (res) {
			res.on('data', function(body) {
				let bfp = JSON.parse(body);
				let bfp2 = JSON.parse(bfp);
				if (bfp2.header.status) {
					debug.log(4, 'rcpclient', 'Received VPNKey Response: ' + res.statusCode);
					mem.setVpnKeyReceivedFlag(true);
					callback(null, bfp2.header.vpnkey);
				} else {
					debug.log(4, 'rcpclient', 'Received Error Response for VPNKey request: ' + bfp2.header.error);
					callback(bfp2.header.error, null);
				}
			});
		}
		if (error) {
			debug.log(1, 'rcpclient', 'Failed to send request-vpnkey: ' + error.message);
			callback(error, null);
		}
	});
}

RCPClient.prototype.sendPublicKey = function(key, callback) {
	let debug = require('./debug.js');
	let mem = require('./mem.js');
	let bfp = require('./bfp.js');
	
	let url = '/send-pubkey';
	
	let message = bfp.BFPCreateSendPublicKey(key);

	this.sendMessage(url, message, function(error, res) {
		if (res) {
			res.on('data', function(body) {
				
				//console.log('Body raw: ' + body);
				//console.log('Body JSON: ' + JSON.stringify(body));
				//console.log('Body parsed JSON: ' + JSON.stringify(JSON.parse(body).body));
				let bfp = JSON.parse(body);
				//let bfp = JSON.parse(body);
				debug.log(4, 'rcpclient', 'Received SendPublicKey Response with cloud key: ' + bfp.body);
				callback(bfp.body)
			});
		}
		if (error) {
			debug.log(1, 'rcpclient', 'Failed to send send-pubkey: ' + error.message);
			callback(error, null);
		}
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
	let accountID = this.config.cloud.id;
	let raspyID = config.rcpclient.vpnID.split('-')[1];
	let initSetupFlag = require('./mem.js').devices[accountID].raspys[raspyID].initSetupFlag;
	
	var db = require('./configdb.js');
	db.getVpnID(accountID, raspyID, function(error, vpnID, vpnKey, initVpnKey) {
		if (error) {
			debug.log(1, 'rcpclient', 'Failed to obtain vpnID and vpnKey from DB: ' + error.message)
		} else {
			//console.log('vpnID: ' + vpnID + ' vpnKey: ' + vpnKey);
	
			let options = {
				hostname: config.rcpclient.host,
				port: config.rcpclient.port,
				path: url,
				method: 'POST',
				agent: false,
				timeout: 2000
			};
			
			if (initSetupFlag) {
				options.headers = {
					'iot-raspyid' : vpnID, 
					'iot-vpnkey' : initVpnKey,
					'Content-Type' : 'application/json'
				};
				options.json = true;
			} else {
				options.headers = {
					'iot-raspyid' : vpnID, 
					'iot-vpnkey' : vpnKey,
					'Content-Type' : 'application/json'
				};
			}

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
		debug.log(1, 'rcpclient', 'Cloud connection dead. Not sending Uplink messages');
		return;
	}

	debug.log(5, 'rcpclient', 'Sending Uplink message to cloud server.');
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
