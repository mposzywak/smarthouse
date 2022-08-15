
var RCPServer = function () {
	
	this.config = require('./config.js');
	this.debug = require('./debug.js')
	this.components = require('./components').setFacility(this, 'rcpserver');
	
	if (this.config.cloud.enabled) {
		require('./init.js').setInit('rcpserver');
		this.app = require('express')();
		this.bodyParser = require('body-parser');
		this.app.use(this.bodyParser.json());
		this.express = require('express');
		this.http = require('http');
		this.server = this.http.createServer(this.app).listen(this.config.rcpserver.port || 32400, onRCPListen);
		this.server.on('error', onRCPError);
		this.app.use(onPreAuth);
		this.app.post('/device', onDevice);
		this.app.post('/heartbeat', onHeartbeat);
		this.app.post('/arduino-dead', onArduinoDead);
		this.app.post('/arduino-alive', onArduinoAlive);
		this.app.post('/uplink', onUplink);
		this.app.post('/request-vpnkey', onRequestVPNKey);
		this.app.post('/send-pubkey', onSendPubKey)
		
		setInterval(monitorRaspys, 3000);
	} else {
		require('./init.js').setInit('rcpserver');
		this.app = require('express')();
		this.bodyParser = require('body-parser');
		this.app.use(this.bodyParser.json());
		this.express = require('express');
		this.http = require('http');
		this.server = this.http.createServer(this.app).listen(this.config.rcpserver.port || 32400, onRCPListen);
		this.server.on('error', onRCPError);
		this.app.post('/downlink', onDownlink);
	}
}

// script for authenticating RCP packets
//const VPNKEY_EXEC = '/etc/openvpn/scripts/openvpn-db-get-pass.sh';

var rcpserver = new RCPServer();

function onRCPListen() {
	require('./debug.js').log(1, 'rcpserver', 'RCP server listening on port: ' +  components.getFacility('config').rcpserver.port || 32400);
	require('./init.js').clearInit('rcpserver');
}

function onRCPError(error) {
	require('./debug.js').log(1, 'rcpserver', 'RCP server failed: ' + error);
}

function onHeartbeat(req, res) {
	authRCP(req, res, function(error){
		if (error == null){
			vpnid = req.get('iot-raspyid');
			accountID = vpnid.split('-')[0]
			raspyID = vpnid.split('-')[1]
			require('./mem.js').updateRaspyIP(accountID, raspyID, req.connection.remoteAddress);
			require('./mem.js').clearRaspyDeadCounter(accountID, raspyID);
			res.writeHead(200, { 'Content-Type' : 'text/plain'});
			res.end('HB ok');
		}
	});
}

function onDevice(req, res) {
	authRCP(req, res, function(error){
		if (error == null){
			vpnid = req.get('iot-raspyid');
			accountID = vpnid.split('-')[0]
			raspyID = vpnid.split('-')[1]
			require('./mem.js').updateRaspyIP(accountID, raspyID, req.connection.remoteAddress);
			require('./mem.js').clearRaspyDeadCounter(accountID, raspyID);
			require('./mem.js').setRCPDeviceStatus(vpnid, srcip, req.body);
		
			res.writeHead(200, { 'Content-Type' : 'text/plain'});
			res.end('HB ok');
		}
	});
}

function onUplink(req, res) {
	authRCP(req, res, function(error) {
		if (error == null) {
			var vpnid = req.get('iot-raspyid');
			var accountID = vpnid.split('-')[0]
			var raspyID = vpnid.split('-')[1]
			var debug = require('./debug.js');
			var mem = require('./mem.js');
			var BFPMessage = req.body;

			mem.updateRaspyIP(accountID, raspyID, req.connection.remoteAddress);
			mem.clearRaspyDeadCounter(accountID, raspyID);
			if (BFPMessage.header) {
				switch (BFPMessage.header.code) {
					case 'BFP_DEVICE_STATUS':
						debug.log(1, 'rcpserver', 'Code BFP_DEVICE_STATUS received, passing to mem');
						/* commented out as it was causing crashes */
						//mem.setDeviceStatus(accountID, req.body);
						break;
					case undefined: 
						debug.log(1, 'rcpserver', 'Undefined Code in BFP, dropping message!');
						break;
					default: 
						debug.log(1, 'rcpserver', 'Unrecognized Code in BFP: ' + BFPMessage.header.code + ', dropping message!');
				}
			}
			
			//require('./mem.js').setRCPDeviceStatus(vpnid, srcip, req.body);
			
			res.writeHead(200, { 'Content-Type' : 'text/plain'});
			res.end('HB ok');
		}
	});
}

/*
 * Function to handle new VPNKey assignment, once it responsds with succesfully code, the VPNKey must be already set.
 */ 
function onRequestVPNKey(req, res) {
	let debug = require('./debug.js');
	let mem = require('./mem.js');
	let bfp = require('./bfp.js');
	let db = require('./configdb.js');
	
	debug.log(4, 'rcpserver', 'Received RCP message: request VPNKey from:');
	authRCP(req, res, function(error) {
		if (error == null) {
			var vpnid = req.get('iot-raspyid');
			var accountID = vpnid.split('-')[0]
			var raspyID = vpnid.split('-')[1]
			debug.log(4, 'rcpserver', 'Received RCP message: request VPNKey from: ' + vpnid);
			
			mem.getLatestVPNKey(accountID, raspyID, function(error, vpnKey, initVpnKey) {
				let BFPMessage;
				if (!error) {
					BFPMessage = bfp.BFPVPNKeyResponse(vpnKey, true, null);
					debug.log(1, 'rcpserver', 'Succesfully obtained VPNKey from mem/DB for: ' + vpnid);
					//res.writeHead(200, { 'Content-Type' : 'text/plain'});
					res.json(JSON.stringify(BFPMessage));
					db.setVpnID(accountID, raspyID, undefined, undefined, undefined, undefined, false);
				} else {
					BFPMessage = bfp.BFPVPNKeyResponse(null, false, 'Could not obtain VPNKey from mem/DB');
					//res.writeHead(500, { 'Content-Type' : 'text/plain'});
					res.json(JSON.stringify(BFPMessage));
					debug.log(1, 'rcpserver', 'Could not obtain VPNKey from mem/DB for: ' + vpnid);
				}
			});
		} else {
			res.writeHead(403, { 'Content-Type' : 'text/plain'});
			res.end();
		}
	});
}

function onDownlink(req, res) {
	authRCP(req, res, function(error) {
		if (error == null) {
			var vpnid = req.get('iot-raspyid');
			var accountID = vpnid.split('-')[0]
			var raspyID = vpnid.split('-')[1]
			var debug = require('./debug.js');
			var mem = require('./mem.js');
			var BFPMessage = req.body;

			if (BFPMessage.header) {
				switch (BFPMessage.header.code) {
					case 'BFP_DEVICE_COMMAND':
						debug.log(1, 'rcpserver', 'Code BFP_DEVICE_COMMAND received, passing to mem');
						//mem.setDeviceStatus(accountID, req.body);
						break;
					case undefined: 
						debug.log(1, 'rcpserver', 'Undefined Code in BFP, dropping message!');
						break;
					default: 
						debug.log(1, 'rcpserver', 'Unrecognized Code in BFP: ' + BFPMessage.header.code + ', dropping message!');
				}
			}
			
			//require('./mem.js').setRCPDeviceStatus(vpnid, srcip, req.body);
			
			res.writeHead(200, { 'Content-Type' : 'text/plain'});
			res.end('HB ok');
		}
	});
}

function onArduinoDead(req, res) {
	authRCP(req, res, function(error){
		if (error == null) {
			vpnid = req.get('iot-raspyid');
			accountID = vpnid.split('-')[0];
			raspyID = vpnid.split('-')[1];
			var ardID = req.query.ardID;
			/* removing as it was causing crashes, not needed */
			//require('./mem.js').setArduinoDead(accountID, raspyID, ardID);
			res.writeHead(200, { 'Content-Type' : 'text/plain'});
			res.end('ok');
		}
	});
}

function onArduinoAlive(req, res) {
	authRCP(req, res, function(error){
		if (error == null) {
			vpnid = req.get('iot-raspyid');
			accountID = vpnid.split('-')[0];
			raspyID = vpnid.split('-')[1];
			var ardID = req.query.ardID;
			/* removing as it was causing crashes, not needed */
			//require('./mem.js').setArduinoAlive(accountID, raspyID, ardID);
			res.writeHead(200, { 'Content-Type' : 'text/plain'});
			res.end('ok');
		}
	});
}

function onSendPubKey(req, res) {
	authRCP(req, res, function(error){
		if (error == null) {
			let vpnid = req.get('iot-raspyid');
			let accountID = vpnid.split('-')[0];
			let raspyID = vpnid.split('-')[1];
			let BFPMessage = req.body;
			let debug = require('./debug.js');
			let os = require('./os.js');
			debug.log(4, 'rcpserver', 'Received send-pubkey message with json body: ' + JSON.stringify(BFPMessage));
			if (typeof(BFPMessage.body) != 'undefined') {
				os.appendKeyToFile('/home/' + require('./config.js').os.serviceUser + '/.ssh/known_hosts', BFPMessage.body + '\n');
			} else {
				debug.log(1, 'rcpserver', 'send-pubkey message does not contain valid key.');
			}
			
			
			let serverSSHKey = os.getServerSSHPublicKey();
			if (typeof(serverSSHKey) != 'undefined') {
				let BFPResponse = require('./bfp.js').BFPCreateSendPublicKey(serverSSHKey);
				res.json(BFPResponse);
				console.log(JSON.stringify(BFPResponse))
				debug.log(4, 'rcpserver', 'Succesfully obtained SSH Public Key from file for: ' + vpnid);
			} else {
				debug.log(1, 'rcpserver', 'Could not obtain SSH Public Key from file for: ' + vpnid);
				res.writeHead(500, { 'Content-Type' : 'text/plain'});
				res.end('Cannot obtain Server SSH Key');
			}
		}
	});
}

function authRCP(req, res, callback) {
	let srcip = req.connection.remoteAddress;
	require('./debug.js').log(5, 'rcpserver', 'Request POST URL: ' + req.originalUrl + ' from: ' + srcip + ' data: ' + JSON.stringify(req.body));
	let vpnid = req.get('iot-raspyid');
	let vpnkey = req.get('iot-vpnkey');
	let accountID = vpnid.split('-')[0];
	let raspyID = vpnid.split('-')[1];
	
	if (req.originalUrl == '/request-vpnkey') {
		callback(null);
		return;
	}
	
	if (!vpnid || !vpnkey) {
		require('./debug.js').log(3, 'rcpserver', 'Request POST did not contain auth headers from: ' + srcip);
		res.writeHead(401, { 'Content-Type' : 'text/plain'});
		res.end('No auth headers');
		callback(1);
		return;
	} else {
		require('./debug.js').log(5, 'rcpserver', 'Request POST contained vpnid: ' + vpnid + ' and vpnkey: ' + vpnkey);
		//var exec = require('child_process').exec;
		let memVpnKey;
		
		memVpnKey = require('./mem.js').getVPNKey(accountID, raspyID);
		//var child = exec(VPNKEY_EXEC + ' ' + vpnid, function (error, stdout, stderr) {
			if (memVpnKey != null) {
				require('./debug.js').log(5, 'rcpserver', 'Succesfully Accessed raspy DB for POST: ' + srcip);
				if (memVpnKey.trim() == vpnkey.trim()) {
					require('./debug.js').log(5, 'rcpserver', 'RCP packet authenticated successfully from: ' + srcip);
					//res.writeHead(200, { 'Content-Type' : 'text/plain'});
					//res.end('Raspy DB accessed');
					callback(null);
					//require('./mem.js').setRCPDeviceStatus(vpnid, srcip, req.body);
				} else {
					require('./debug.js').log(3, 'rcpserver', 'RCP packet authentication failed from: ' + srcip);
					res.writeHead(401, { 'Content-Type' : 'text/plain'});
					res.end('Auth failed');
					callback(2)
				}
			} else {
				require('./debug.js').log(1, 'rcpserver', 'failed to obtain vpnKey from mem.');
				res.writeHead(500, { 'Content-Type' : 'text/plain'});
				res.end('Raspy DB cannot be accessed');
				callback(3)
			}
			//console.log('exec: ' + VPNKEY_EXEC + ' ' + raspyid);
			//console.log('stdout: ' + stdout + ' error: ' + error + ' vpnkey: ' + vpnkey);
		
	}
}

function onPreAuth(req, res, next) {
	if (req.originalUrl == '/request-vpnkey') {
		let mem = require('./mem.js');
		let debug = require('./debug.js');
		let bfp = require('./bfp.js');
		let vpnid = req.get('iot-raspyid');
		let vpnkey = req.get('iot-vpnkey');
		let accountID = vpnid.split('-')[0];
		let raspyID = vpnid.split('-')[1];
		let srcip = req.connection.remoteAddress;
	
		if (!vpnid || !vpnkey) {
			debug.log(3, 'rcpserver', 'Request POST did not contain auth headers from: ' + srcip);
			//res.writeHead(401, { 'Content-Type' : 'text/plain'});
			let BFPMessage = bfp.BFPVPNKeyResponse(null, false, 'no auth headers');
			res.json(BFPMessage);
		} else {
			debug.log(5, 'rcpserver', '/request-vpnkey special URL detected. Obtaining keys from DB.')
			mem.getLatestVPNKey(accountID, raspyID, function(error, vpnKey, initVpnKey) {
				if (!error) {
					if (initVpnKey.trim() == vpnkey.trim()) {
						debug.log(5, 'rcpserver', '/request-vpnkey RCP packet authenticated successfully from: ' + srcip);
						next();
					} else {
						require('./debug.js').log(3, 'rcpserver', '/request-vpnkey RCP packet authentication failed from: ' + srcip);
						//res.writeHead(401, { 'Content-Type' : 'text/plain'});
						let BFPMessage = bfp.BFPVPNKeyResponse(null, false, 'auth failed');
						res.json(BFPMessage);
					}
				} else {
					
				}
			});
		}
	} else {
		next();
	}
}


function monitorRaspys() {
	var mem = require('./mem.js');
	var accounts = mem.devices;
	for (var accountID in accounts) {
		if (accounts.hasOwnProperty(accountID)) {
			for (var raspyID in accounts[accountID].raspys) {
				if (accounts[accountID].raspys.hasOwnProperty(raspyID)) {
					mem.increaseRaspyDeadCounter(accountID, raspyID);
				}
			}
		}
	}
}

module.exports = rcpserver;