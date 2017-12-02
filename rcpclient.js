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
		require('./rcpclient.js').isCloudAlive = true;
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
			+ device.ardid + ' devID: ' + device.devid);

	var options = {
		hostname: this.config.rcpclient.host,
		port: this.config.rcpclient.port,
		path: '/device',
		method: 'POST',
		agent: false,
		headers: {
			'iot-raspyid' : this.config.rcpclient.vpnID, 
			'iot-vpnkey' : this.config.rcpclient.vpnkey
		}
	};
	
	var req = http.request(options, function (res){
		require('./debug.js').log(4, 'rcpclient', 'Received STATUS: ' + res.statusCode + 
				' for ardid: ' + device.ardid + ' devid: ' + device.devid);
	}).on('error', function(error) {
		require('./debug.js').log(1, 'rcpclient', 'Failed to establish connection with the cloud: ', 
				error.message);
	});
	
	req.write(JSON.stringify(device),encoding='utf8');
	req.end();

}

module.exports = rcpclient;