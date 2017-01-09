
/* Debug facility initialization */
var Debug = function() {
	this.config = {};
	this.components = require('./components').setFacility(this, 'debug');
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

/* */
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
 *  wget -qO- http://localhost:32301/mem | python -m json.tool
 */
Debug.prototype.onDebugRequest = function(req, res) {
	url = req.originalUrl.split('/').splice(1);
	
	memText = JSON.stringify(this.components[url[0]]);
	this.components.getFacility('debug').log(1, 'debug', 'Full ' + url[0] + ' output: ' + memText);
	res.writeHead(200, { 'Content-Type' : 'application/json'});
    res.end(memText);
	
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
