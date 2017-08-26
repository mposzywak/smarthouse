
var RCPServer = function () {
	
	this.config = require('./config.js');
	this.debug = require('./debug.js')
	this.components = require('./components').setFacility(this, 'rcpserver');
	require('./init.js').setInit('rcpserver');
	this.app = require('express')();
	this.bodyParser = require('body-parser');
	this.app.use(this.bodyParser.json());
	this.express = require('express');
	this.http = require('http');
	this.server = this.http.createServer(this.app).listen(this.config.rcpserver.port || 32400, onRCPListen);
	this.server.on('error', onRCPError);
	this.app.post('/device', onPostRequest);
}

// script for authenticating RCP packets
const VPNKEY_EXEC = '/etc/openvpn/scripts/openvpn-db-get-pass.sh';

var rcpserver = new RCPServer();

function onRCPListen() {
	require('./debug.js').log(1, 'rcpserver', 'RCP server listening on port: ' +  components.getFacility('config').rcpserver.port || 32400);
	require('./init.js').clearInit('rcpserver');
}

function onRCPError(error) {
	require('./debug.js').log(1, 'rcpserver', 'RCP server failed: ' + error);
}

function onPostRequest(req, res) {
	srcip = req.connection.remoteAddress;
	require('./debug.js').log(5, 'rcpserver', 'Request POST URL: ' + req.originalUrl + ' from: ' + srcip + ' data: ' + JSON.stringify(req.body));
	vpnid = req.get('iot-raspyid');
	vpnkey = req.get('iot-vpnkey');
	if (!vpnid || !vpnkey) {
		require('./debug.js').log(1, 'rcpserver', 'Request POST did not contain auth headers from: ' + srcip);
		res.writeHead(401, { 'Content-Type' : 'text/plain'});
		res.end('No auth headers');
		return;
	} else {
		require('./debug.js').log(1, 'rcpserver', 'Request POST contained vpnid: ' + vpnid + ' and vpnkey: ' + vpnkey);
		var exec = require('child_process').exec;
		var child = exec(VPNKEY_EXEC + ' ' + vpnid, function (error, stdout, stderr) {
			if (error == null) {
				require('./debug.js').log(5, 'rcpserver', 'Succesfully Accessed raspy DB for POST: ' + srcip);
				if (stdout.trim() == vpnkey.trim()) {
					require('./debug.js').log(5, 'rcpserver', 'RCP packet authenticated successfully from: ' + srcip);
					res.writeHead(200, { 'Content-Type' : 'text/plain'});
					res.end('Raspy DB cannot be accessed');
					//console.log('rcp-server, vpnid: ' + vpnid);
					require('./mem.js').setRCPDeviceStatus(vpnid, srcip, req.body);
				} else {
					require('./debug.js').log(2, 'rcpserver', 'RCP packet authentication failed from: ' + srcip);
					res.writeHead(401, { 'Content-Type' : 'text/plain'});
					res.end('Auth failed');
				}
			} else {
				require('./debug.js').log(5, 'rcpserver', 'failed to access raspy DB, code: ' + error + ' stderr: ' + stderr);
				res.writeHead(500, { 'Content-Type' : 'text/plain'});
				res.end('Raspy DB cannot be accessed');
			}
			//console.log('exec: ' + VPNKEY_EXEC + ' ' + raspyid);
			//console.log('stdout: ' + stdout + ' error: ' + error + ' vpnkey: ' + vpnkey);
		});
	}
}

//function authenticateRequest(, )

module.exports = rcpserver;