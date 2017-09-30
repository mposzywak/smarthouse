var RCPClient = function () {
	
	this.config = require('./config.js');
	this.debug = require('./debug.js')
	this.components = require('./components').setFacility(this, 'rcpclient');
	
	// Create HTTP client
	///this.http = require('http');
	//this.rcpserver = http.createClient(this.config.cloud.host, this.config.cloud.port);
}

var rcpclient = new RCPClient();

RCPClient.prototype.sendDeviceStatus = function(device) {
	// Create HTTP client
	var http = require('http');
	var rcpclient = http.createClient(this.config.rcpclient.port, this.config.rcpclient.host);
	var request = rcpclient.request('POST', '/device', {'host': 'sever',  'content-type': 'application/json', 
			'iot-raspyid' : this.config.rcpclient.vpnID, 'iot-vpnkey' : this.config.rcpclient.vpnkey});
	request.write(JSON.stringify(device),encoding='utf8'); //possibly need to escape as well? 
	require('./debug.js').log(4, 'rcpclient', 'Sending device status of device, ardid: ' + device.ardid + ' devid: ' + device.devid);
	rcpclient.on('error', function (error) {
		require('./debug.js').log(1, 'rcpclient', 'Failed to establish connection with the cloud: ', error.message);
	});

	request.on('response', function (response) {
		require('./debug.js').log(4, 'rcpclient', 'Received STATUS: ' + response.statusCode + ' for ardid: ' + device.ardid + ' devid: ' + device.devid);
	});
	
	request.end();
}

module.exports = rcpclient;