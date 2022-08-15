
/* Debug facility initialization */
var Debug = function() {
	this.config = {};
	this.components = require('./components.js').setFacility(this, 'debug');
}

var debug = new Debug();

/* start an internal HTTP server for debugging purposes
   setConfig() should be called first or else there will be an exception
 */
Debug.prototype.enableDebugServer = function() {
	this.components.getFacility('init').setInit('debug');
	this.appDebug = require('express')();
	this.httpDebug = require('http');
	this.serverDebug = this.httpDebug.createServer(this.appDebug).listen(
		components.getFacility('config').debug.port || 32301, '127.0.0.1', onHTTPDebugListen);
	this.serverDebug.on('error', onHTTPDebugError);

	this.appDebug.get('/*', this.onDebugRequest);
	
	return this;
}

/* main logging function */
Debug.prototype.log = function(severity, facility, msg) {
	if (typeof(this.components.getFacility('config')[facility]) == 'undefined') {
		date = new Date();
		dateString = date.toString().split(' ').splice(1,4).join(' ') + ':' + date.getMilliseconds();
		console.log(dateString + ' Facility: ' + facility + ' is undefined. The log() function is called improperly');
	} else {
		if (this.components.getFacility('config')[facility].debug >= severity) {
			date = new Date();
			dateString = date.toString().split(' ').splice(1,4).join(' ') + ':' + date.getMilliseconds();
			console.log(dateString + ' [' + facility + ': ' + severity + ' ] ' + msg);
		}
	}
}

/*
 * handle debug GETs, example usage:
 *
 *  wget -qO- http://localhost:32303/view/mem/devices | python -m json.tool
 *  Don't display directly the facility objects as they have circular structure
 *  for example /view/mem will not work, but /view/mem/devices will. Config facility doesn't
 *  have circular structure as the only one. Don't add "/" at the end of the URL. 
 *  ### TODO: Add handling of the following: TypeError: Converting circular structure to JSON
 *  and TypeError: Cannot read property '1' of undefined
 */
Debug.prototype.onDebugRequest = function(req, res) {
	var url = req.originalUrl.split('/');
	var command = url[1];
	
	switch (command) {
		case 'view':
			object = JSON.stringify(viewDataCMD(url));
			break;
	}
	//memText = JSON.stringify(this.components.getFacility(url[0]));
	this.components.getFacility('debug').log(1, 'debug', 'Full ' + req.originalUrl + ' output: ' + object);
	res.writeHead(200, { 'Content-Type' : 'application/json'});
    res.end(object);
	
}

function viewDataCMD(url) {
	object = this.components.getFacility(url[2]);
	for (i = 3 ; i < url.length ; i++) {
		object = object[url[i]];
	}
	return object;
}

/* executed when Debug HTTP server starts to listen on port succesfully */
function onHTTPDebugListen() {
	components.getFacility('debug').log(1, 'debug', 'Debug HTTP server started succesfully, listening on port: ' + 
			components.getFacility('config').debug.port || 32301);
	require('./components').getFacility('init').clearInit('debug');
}

/* executed when Debug HTTP server encounters an unrecoverable error and quits the app */
function onHTTPDebugError(err) {
	components.getFacility('debug').log(1, 'debug', 'Debug HTTP server failed: ' + err);
	process.exit(1);
}

module.exports = debug;
