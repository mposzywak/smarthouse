var RCPClient = function () {
	
	this.config = require('./config.js');
	this.debug = require('./debug.js')
	this.components = require('./components').setFacility(this, 'rcpclient');
	
	this.isCloudAlive = false;
	
	// Create HTTP client
	///this.http = require('http');
	//this.rcpserver = http.createClient(this.config.cloud.host, this.config.cloud.port);

	setInterval(sendHeartbeat, 3000);

}

var rcpclient = new RCPClient();

function sendHeartbeat() {
	var http = require('http');
	var config = require('./config.js');
	
	require('./debug.js').log(4, 'rcpclient', 'Sending heartbeat to: ' + config.rcpclient.host);

	var options = {
		hostname: config.rcpclient.host,
		port: config.rcpclient.port,
		path: '/heartbeat',
		method: 'POST',
		agent: false,
		headers: {
			'iot-raspyid' : config.rcpclient.vpnID, 
			'iot-vpnkey' : config.rcpclient.vpnkey
		}
	};
	
	var req = http.request(options, function (res){
		require('./debug.js').log(4, 'rcpclient', 'Heartbeat Received STATUS: ' + res.statusCode);
		onHeartbeatResponse(res);
	}).on('error', function(error) {
		require('./debug.js').log(1, 'rcpclient', 'Heartbeat failed to establish connection with the cloud: ', 
				error.message);
		require('./rcpclient.js').isCloudAlive = false;
	});
	
	req.write('',encoding='utf8');
	req.end();

}


RCPClient.prototype.sendDeviceStatus = function(device) {
	// Create HTTP client
	var http = require('http');
	
	require('./debug.js').log(4, 'rcpclient', 'Sending device status of ardID: ' 
			+ device.ardID + ' devID: ' + device.devID);

	var options = {
		hostname: this.config.rcpclient.host,
		port: this.config.rcpclient.port,
		path: '/device',
		method: 'POST',
		agent: false,
		headers: {
			'iot-raspyid' : this.config.rcpclient.vpnID, 
			'iot-vpnkey' : this.config.rcpclient.vpnkey,
			'Content-Type' : 'application/json'
		}
	};
	
	var req = http.request(options, function (res){
		require('./debug.js').log(4, 'rcpclient', 'Received STATUS: ' + res.statusCode + 
				' for ardID: ' + device.ardID + ' devid: ' + device.devID);
	}).on('error', function(error) {
		require('./debug.js').log(1, 'rcpclient', 'Failed to send Device Status: ', 
				error.message);
	});
	
	req.write(JSON.stringify(device), encoding='utf8');
	req.end();

}

RCPClient.prototype.sendArduinoAlive = function(ardID) {
	var url = '/arduino-alive?ardID=' + ardID;
	
	require('./debug.js').log(4, 'rcpclient', 'Sending arduino-alive, ardID: ' + ardID);
	
	this.sendMessage(url, null, function(error, res) {
		if (res)
			require('./debug.js').log(4, 'rcpclient', 'Received STATUS: ' + res.statusCode + ' to arduino-alive');
		if (error)
			require('./debug.js').log(1, 'rcpclient', 'Failed to send arduino-alive: ', error.message);
	});
}

RCPClient.prototype.sendArduinoDead = function(ardID) {
	var url = '/arduino-dead?ardID=' + ardID;
	
	require('./debug.js').log(4, 'rcpclient', 'Sending arduino-dead, ardID: ' + ardID);
	
	this.sendMessage(url, null, function(error, res) {
		if (res)
			require('./debug.js').log(4, 'rcpclient', 'Received STATUS: ' + res.statusCode + ' to arduino-dead');
		if (error)
			require('./debug.js').log(1, 'rcpclient', 'Failed to send arduino-dead: ', error.message);
	});
}


/** Send generic message on RCP 
 * put URL, payload has to be a JSON argument, if set to NULL or '' body will be sent empty
 * callback has the following arguments: callback(error, res)
 */
RCPClient.prototype.sendMessage = function(url, payload, callback) {
	var http = require('http');
	var options = {
		hostname: this.config.rcpclient.host,
		port: this.config.rcpclient.port,
		path: url,
		method: 'POST',
		agent: false,
		headers: {
			'iot-raspyid' : this.config.rcpclient.vpnID, 
			'iot-vpnkey' : this.config.rcpclient.vpnkey,
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



function onHeartbeatResponse(res) {
	var isCloudAlive = require('./rcpclient.js').isCloudAlive;
	if (res.statusCode == 200 && isCloudAlive == false) {
		require('./rcpclient.js').isCloudAlive = true;
		require('./debug.js').log(2, 'rcpclient', 'Setting Cloud connection alive. Sending Device status');
		// Send status of all alive devices to the Cloud
		require('./mem.js').sendRCPAllDeviceStatus(require('./rcpclient.js'));
	} else if (res.statusCode != 200) {
		require('./debug.js').log(1, 'rcpclient', 'Incorrect StatusCode received on RCP from Cloud Server!');
	}
}

module.exports = rcpclient;