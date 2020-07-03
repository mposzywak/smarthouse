

let OS = function() {
	this.config = require('./config.js');
	this.debug = require('./debug.js');
	this.fs = require('fs');
}

let os = new OS();


/**
 * Restart OpenVPN instance through systemctl
 */
OS.prototype.restartVPN = function() {
	let os = this;
	
	this.stopVPN(function(error, output) {
		if (!error)
			os.startVPN();
	});
}

/**
 * Check if 
 */
OS.prototype.getVPNStatus = function(callback) {
	let debug = require('./debug.js');
	
	require('child_process').exec('/bin/systemctl show openvpn@root --property=ActiveState', function(err, stdout, stderr) {
		if (err) {
			debug.log(1, 'os', 'returned error for VPN status query (systemctl): ' + stderr);
			callback(err, stderr);
			return;
		}
		debug.log(3, 'os', 'returned VPN status (systemctl): ' + stdout);
		
		if (stdout.indexOf('ActiveState=inactive') > -1)  {
			callback(null, false);
		} else if (stdout.indexOf('ActiveState=active') > -1) {
			callback(null, true);
		} else {
			callback(null, false);
		}
	});
}

/**
 * Set OpenVPN username and password
 */
OS.prototype.setVPNCredentials = function(username, password) {
	let content = username + '\n' + password
	let options = { mode: 0o600}
	let os = this.config.os;
	let debug = require('./debug.js');

	this.fs.writeFile(os.vpnCredentialsFile, content, options, function(err) {
	    if(err) {
	        debug.log(1, 'os', 'Cannot write VPN credentails into file: ' + os.vpnCredentialsFile);
			return;
	    }
	    debug.log(4, 'os', 'VPN credentials succesfully written into: ' + os.vpnCredentialsFile);
	}); 
}

/**
 * Start OpenVPN instance through systemctl
 */
OS.prototype.startVPN = function(callback) {
	let debug = require('./debug.js');
	
	require('child_process').exec('systemctl start openvpn@root', function(err, stdout, stderr) {
		if (err) {
			debug.log(1, 'os', 'returned systemctl error (start): ' + stderr);
			if (callback) callback(err, stderr);
			return;
		}
		debug.log(3, 'os', 'returned systemctl output (start): ' + stdout);
		if (callback) callback(null, stdout);
	});
	
}

/**
 * Stop OpenVPN instance through systemctl
 */
OS.prototype.stopVPN = function(callback) {
	let debug = require('./debug.js');

	require('child_process').exec('systemctl stop openvpn@root', function(err, stdout, stderr) {
		if (err) {
			debug.log(1, 'os', 'returned systemctl error (stop): ' + stderr);
			if (callback) callback(err, stderr);
			return;
		}
		debug.log(3, 'os', 'returned systemctl output (stop): ' + stdout);
		if (callback) callback(null, stdout);
	});
}

OS.prototype.enableVPN = function(callback) {
	let debug = require('./debug.js');

	require('child_process').exec('systemctl enable openvpn@root', function(err, stdout, stderr) {
		if (err) {
			debug.log(1, 'os', 'returned systemctl error (enable): ' + stderr);
			if (callback) callback(err, stderr);
			return;
		}
		debug.log(3, 'os', 'returned systemctl output (enable): ' + stdout);
		if (callback) callback(null, stdout);
	});
}

OS.prototype.disableVPN = function(callback) {
	let debug = require('./debug.js');
	
	require('child_process').exec('systemctl disable openvpn@root', function(err, stdout, stderr) {
		if (err) {
			debug.log(1, 'os', 'returned systemctl disable (stop): ' + stderr);
			if (callback) callback(err, stderr);
			return;
		}
		debug.log(3, 'os', 'returned systemctl disable (stop): ' + stdout);
		if (callback) callback(null, stdout);
	});
}

/**
 * Check if the VPN is enabled through systemctl
 */ 
OS.prototype.isVPNenabled = function(callback) {
	let debug = require('./debug.js');

	require('child_process').exec('/bin/systemctl show openvpn@root --property=UnitFileState', function(err, stdout, stderr) {
		if (err) {
			debug.log(1, 'os', 'returned error for VPN enabled query (systemctl): ' + stderr);
			if (callback) callback(err, stderr);
			return;
		}
		debug.log(3, 'os', 'returned VPN enabled status (systemctl): ' + stdout);
		
		if (stdout.indexOf('UnitFileState=disabled') > -1) {
			if (callback) callback(null, false);
		} else if (stdout.indexOf('UnitFileState=enabled') > -1) {
			if (callback) callback(null, true);
		} else {
			if (callback) callback(null, false);
		}
	});
}

/**
 * Check if VPN is connected according to the /etc/openvpn/status file
 */
OS.prototype.isVPNConnected = function() {
	let os = this.config.os;
	let debug = require('./debug.js');
	let content;

	content = this.fs.readFileSync(os.vpnStatusFile, 'utf8');
	
	debug.log(3, 'os', 'read VPN status file: ' + content);
	
	if (content.indexOf('UP') > -1) {
		return true;
	} else if (content.indexOf('DOWN') > -1) {
		return false;
	} else {
		return false;
	}
}

module.exports = os;