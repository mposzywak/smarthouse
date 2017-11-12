
const ARIF_LIGHT_ON  = '1';
const ARIF_LIGHT_OFF = '2';

const MSG_ARD_SUCCESS = '0';
const MSG_ARD_UNREACHABLE = '1';

var ARiF = function() {
	this.config = require('./config.js');
	this.debug = require('./debug.js');
}

var arif = new ARiF();

ARiF.prototype.sendCommand = function(device, command, callback) {
	debug = this.debug;
	debug.log(1, 'arif', 'Sending ARiF command to device devID: ' + device.devID + ' ardID: ' + 
			device.ardID + ' IP: ' + device.IP + ' command: ' + command);
				
	var http = require('http');
	
	var options = {
		hostname: device.IP,
		port: this.config.arif.port,
		path: '/' + device.devID + '/' + device.ardID + '/' + this.config.rcpclient.vpnID.split('-')[1] + '/' + command,
		method: 'POST',
		agent: false
	};
	
	var req = http.request(options, function (res){
		debug.log(1, 'arif', 'Received ARiF command resp from: ' + device.devID + ' ardID: ' + 
			device.ardID + ' IP: ' + device.IP);
	}).on('error', function(error) {
		debug.log(1, 'arif', 'Error in ARiF comms with: ' + device.devID + ' ardID: ' + 
			device.ardID + ' IP: ' + device.IP);
	});
	
	req.write('');
	req.end();
	
	/*var ARiFRaspyClient = http.createClient(this.config.arif.port, device.IP);
	var request = ARiFRaspyClient.request('POST', '/' + device.devID + '/' + device.ardID + '/' + this.config.rcpclient.vpnID.split('-')[1] +
			'/' + command, {'host': 'raspy',  'content-type': 'application/json'});
	request.write(JSON.stringify(device), encoding='utf8'); //possibly need to escape as well? 
	
	ARiFRaspyClient.on('error', function (error) {
		require('./debug.js').log(1, 'arif', 'Failed to establish connection with the arduino: ', error.message);
		message = {};
		message.device = device;
		message.response = MSG_ARD_UNREACHABLE;
		callback(message);
	});

	request.on('response', function (response) {
		require('./debug.js').log(4, 'arif', 'Received STATUS: ' + response.statusCode + ' for ardID: ' + device.ardID + ' devID: ' + device.devID);
	});
	
	request.end(); */
}

module.exports = arif;