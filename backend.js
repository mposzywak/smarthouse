/**
 * settings
 */
const ADD_EXEC = '/home/maciej/accountdb/add-account.sh';
const AUTH_EXEC = '/home/maciej/accountdb/verify-account.sh';

const LOGIN_PAGE = 'login2.html'

/* message codes */
	const ALLOW_PENDING_ARD = 0;
	const REMOVE_PENDING_ARD = 1;

	const IGNORE_DISCOVERED_DEVICE = 2;


/**
 * Backend is the HTTP server that is serving the client requests, it 
 * is the user interface to the system.
 */
var Backend = function() {
	var sessions = {};
	
	this.components = require('./components').setFacility(this, 'backend');
	this.debug = components.getFacility('debug');
	
	require('./init.js').setInit('backend');
	this.app 		= require('express')();
	this.express 	= require('express');
	this.http 		= require('http');
	this.session	= require('express-session');
	this.bodyParser = require('body-parser');
	this.config 	= require('./config.js');
	this.cookie 	= require('cookie-parser');
	var EventEmitter = require('events').EventEmitter;
	this.emitter      = new EventEmitter();
	
	this.fileStore = require('session-file-store')(this.session);

	this.FILEStore = new this.fileStore();
	this.app.set('views', __dirname + '/front_end');
	this.app.engine('html', require('ejs').renderFile);
	this.app.set('view engine', 'html');
	
	this.app.use(this.session({
		store: this.FILEStore,
		secret: 'fdsifoa4efioehfrafoeffjisaofew',
		saveUninitialized: true,
		resave: true
	}));

	this.app.use(this.bodyParser.json());      
	this.app.use(this.bodyParser.urlencoded({extended: true}));
	this.app.use('/css', this.express.static('front_end/css'));
	this.app.use('/js', this.express.static('front_end/js'));
	this.app.get('/admin', onAdmin);
	this.app.get('/\*.html', onAnyHTML);
	/* specific html service functions */
	this.app.get('/device-active', onDeviceActive);
	this.app.get('/device-configuration', onDeviceConfiguration);
	//this.app.get('\/device-configuration-single\/[0-9]{3}\/[0-9]{1,3}\/[0-9]{1,3}', onDeviceConfigurationSingle);
	this.app.get('/device-configuration-single', onDeviceConfigurationSingle);
	this.app.get('/device-configuration-arduino', onDeviceConfigurationArduino);
	this.app.get('/device-configuration-discovered', onDeviceConfigurationDiscovered);
	this.app.get('/device-configuration-shade', onDeviceConfigurationShade);
	this.app.get('/device-discovery', onDeviceDiscovery);
	this.app.get('/settings', onSettings);

	this.app.get('', onAnyHTML);       // redirect to login page on '/'
	//executed on login inforamtion
	this.app.post('/auth', onLogin);
	//this.app.post('/logout', onLogout);

	this.app.get('/logout', onLogout);
	
	// setup the server for listening on the port
	this.server = this.http.createServer(this.app).listen(components.getFacility('config').backend.port || 80, onListen);
	this.io = require('socket.io').listen(this.server);
	this.io.of('/iot').use(onWSAuthorize);
	//this.io.of('/iot').on('disconnect', onWSDisconnect);
	this.server.on('error', onError);		// executed when cannot start the backend server
	this.db = require('./configdb.js');
}

var backend = new Backend();

/* execute when the server succesfully starts listening */
function onListen() {
	require('./debug.js').log(1, 'backend', 'Backend server listening on port: ' +  components.getFacility('config').backend.port || 80);
	require('./init.js').clearInit('backend');
}

/* execute when the backend HTTP server encounters an unrecoverable error and quit */
function onError(err) {
	require('./debug.js').log(1, 'backend', 'Unable to setup backend server: ' + err);
	process.exit(1);
}

/**
 * Function that renders the requested HTML file, or sends 404 in case file doesn't exist.
 * Called by onAnyHTML function.
 */
function renderFile(req, res) {
	sourceIP = req.connection.remoteAddress
	res.render(req.originalUrl.substr(1), function(err, html) {
		if (err) {
			require('./debug.js').log(5, 'backend', 'Received GET for unknown file: ' + req.originalUrl + ', sending 404 to: ' + sourceIP);
			res.status(303).send('File Not found');
		} else {
			require('./debug.js').log(5, 'backend', 'Received GET for: ' + req.originalUrl + ' from: ' + sourceIP);
			res.send(html);
		}
	});
}

/**
 * Middleware executed on root contains redirect if not login, 
 * should also handle all pages which require login.
 */
function onAnyHTML(req,res) {
	//if CSS just give the file

	var sess = req.session;
	if(sess.email) {
		renderFile(req, res);
	} else {
		res.render(LOGIN_PAGE);
		require('./debug.js').log(5, 'backend', 'Backend received GET for URL w/o cookie: ' + req.originalUrl + ', redirecting');
	}
}

/**
 * POST command with login and password, upon verification should let us in.
 */
function onLogin(req, res) {
	email = req.body.email;
	pass = req.body.pass;
	require('./debug.js').log(5, 'backend', 'Auth POST received with email: ' + email + ' pass: ' + pass);
	verify(email, pass, function (code) {
		if (code === 0) {
			require('./debug.js').log(5, 'backend', 'Correct login for: ' + email);
			req.session.email = email;
			res.header('Access-Control-Allow-Origin', 'http://duinocloud.com:10080/*');
			res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
			res.header('Access-Control-Allow-Headers', 'Content-Type');
			res.end('done');
		} else {
			// bad user or pass, will not send cookie
			require('./debug.js').log(5, 'backend', 'Bad login for: ' + email + ' code: ' + code);
			res.end('bad');
		}
	});
}


/**
 * Load the administrative page upon succesfull login
 */
function onAdmin(req, res) {
	var sess = req.session;
	if(sess.email)	
	{
		res.render('device_active.html');
	}
	else
	{
		res.redirect('/');
	}
}

function onDeviceActive(req, res) {
	var sess = req.session;
	if(sess.email)	
	{
		res.render('device_active.html');
	}
	else
	{
		res.redirect('/');
	}
}

function onDeviceDiscovery(req, res) {
	var sess = req.session;
	if(sess.email)	
	{
		res.render('device_discovery.html');
	}
	else
	{
		res.redirect('/');
	}
}

function onDeviceConfiguration(req, res) {
	var sess = req.session;
	if(sess.email)	
	{
		res.render('device_configuration.html');
	}
	else
	{
		res.redirect('/');
	}
}

function onDeviceConfigurationSingle(req, res) {
	var sess = req.session;
	if(sess.email)	
	{
		res.render('device_configuration_single.html');
	}
	else
	{
		res.redirect('/');
	}
}

function onDeviceConfigurationArduino(req, res) {
	var sess = req.session;
	if(sess.email)	
	{
		res.render('device_configuration_arduino.html');
	}
	else
	{
		res.redirect('/');
	}
}

function onDeviceConfigurationDiscovered(req, res) {
	var sess = req.session;
	if(sess.email)	
	{
		res.render('device_configuration_discovered.html');
	}
	else
	{
		res.redirect('/');
	}
}

function onDeviceConfigurationShade(req, res) {
	var sess = req.session;
	if(sess.email)	
	{
		res.render('device_configuration_shade.html');
	}
	else
	{
		res.redirect('/');
	}
}

function onSettings(req, res) {
	var sess = req.session;
	var config 	= require('./config.js');

	if(sess.email)	
	{
		if (!config.cloud.enabled)
			res.render('settings_raspy.html');
		else 
			res.render('settings_cloud.html');
	}
	else
	{
		res.redirect('/');
	}
}

/**
 * Function executed on logout
 */
function onLogout(req,res) {
	var email = req.session.email;
	req.session.destroy(function(err) {
		if(err){
			require('./debug.js').log(5, 'backend', 'Logout issue with email: ' + email + ' error: ' + err);
			console.log(err);
		} else {
			res.redirect('/');
		}
	});
}

/*
function onLogout(req, res) {
	var email = req.session.email;
	console.log('logout')
	req.session.destroy(function(err) {
  	// cannot access session here
  	require('./debug.js').log(5, 'backend', 'Logout POST received with email: ' + email);
  	res.end('done');
	})
}
*/

/**
 *
 */
function verify(login, password, callback) {
	// check if the username is in the config file
	id = components.getFacility('config').cloud.id;
	pass = components.getFacility('config').cloud.passwd;
	enabled = components.getFacility('config').cloud.enabled;
	if (id && pass && !enabled)
	{
		if (login === id && password === pass) {
			//login ok
			callback(0);
			//return true;
		} else {
			callback(1);
		}
	} else { // TODO: check DB for username
		var exec = require('child_process').exec;
		var child = exec(AUTH_EXEC + ' ' + login + ' ' + password, function (error, stdout, stderr) {
			if (error !== null) {
				//console.log('exec error: ' + error);
				//console.log('error code: ' + error.code);
				callback(error.code);
			} else {
				//console.log('succesfully auth');
				//timer.start();
				callback(0);

			}
		});
	}
	return false;
}

/**
 * First middleware function of the io.socket
 */

function onWSAuthorize(socket, next) {
	var clientIp = socket.request.connection.remoteAddress;
	var clientPort = socket.request.connection.remotePort;
	var source = clientIp + ':' + clientPort;
	var config = require('./config.js');
	require('./debug.js').log(5, 'backend', 'New WS connection received from: ' + source);
	
	cookie = socket.request.headers.cookie;
	if (cookie) {
		require('./debug.js').log(5, 'backend', 'Cookie received: ' + cookie + ' from: ' + source);
		id = cookie.match('connect.sid=[\\w\\%\\d\\-]*')[0].substring(16);
		//console.log('ID = ' + id);
		backend.FILEStore.get(id, function(error, session) {
			if (error)
			{
				require('./debug.js').log(5, 'backend', 'Error while reading session data from DB for: ' + source + ' error: ' + error);
			} else {
				if (session) {
					if (session.email) {
						email = session.email;
						require('./debug.js').log(5, 'backend', '[' + email + '] WS session established from: ' + source);
						socket.session = session;
						socket.on('disconnect', function() {
							onWSDisconnect(session);
						});
		
						socket.join(email);
						socket.session = session;
						pushAllDevices(socket, email);
						pushAllArduinos(socket, email);
						if (!config.cloud.enabled)
							sendBFPCloudStatus(socket, email);
						//require('./rcpclient.js').sendBFPCloudStatus(null);
						socket.on('device_settings', function (BFPPayload) {
							//console.log('device_activate received');
							onBFPGenericMessage('device_settings', BFPPayload, socket);
						});
						socket.on('device_command', function (BFPPayload) {
							onBFPGenericMessage('device_command', BFPPayload, socket);
						});
						socket.on('update_pending_arduino', function (BFPPayload) {
							onBFPGenericMessage('update_pending_arduino', BFPPayload, socket);
						});
						socket.on('update_arduino', function (BFPPayload) {
							onBFPGenericMessage('update_arduino', BFPPayload, socket);
						});
						socket.on('delete_arduino', function (BFPPayload) {
							onBFPGenericMessage('delete_arduino', BFPPayload, socket);
						});
						socket.on('device_discovered', function (BFPPayload) {
							onBFPGenericMessage('device_discovered', BFPPayload, socket);
						});
						socket.on('device_ignore', function (BFPPayload) {
							onBFPGenericMessage('device_ignore', BFPPayload, socket);
						});
						next();
					} else {
						require('./debug.js').log(5, 'backend', 'WS cookie received, session present, but no accountID associatiated, hence closing from: ' + source);
						next(new Error('Bad cookie, no email. Please relogin.'));
					}
				} else {
					//socket.disconnect();
					require('./debug.js').log(5, 'backend', 'WS cookie received but no session associatiated, hence closing from: ' + source);
					next(new Error('Bad cookie, no email. Please relogin.'));
				}
			}
		});
		//next();
	} else {
		require('./debug.js').log(5, 'backend', 'WS no cookie received from: ' + source);
		next(new Error('No cookie. Please login.'));
	}
}

function onBFPGenericMessage(msg, BFPPayload, socket) {
	var config = require('./config.js');
	if (!config.cloud.enabled) {
		switch(msg) {
			case 'device_settings':
				onBFPDeviceUpdate(BFPPayload, socket);
				break;
			case 'device_command':	
				onBFPDeviceCommand(BFPPayload, socket);
				break;
			case 'update_pending_arduino':
				onBFPUpdatePendingArduino(BFPPayload, socket);
				break;
			case 'update_arduino':
				onBFPUpdateArduino(BFPPayload, socket);
				break;
			case 'delete_arduino':
				onBFPDeleteArduino(BFPPayload, socket);
				break;
			case 'device_discovered':
				onBFPDeviceDiscovered(BFPPayload, socket);
				break;
			case 'device_ignore':
				onBFPDeviceIgnore(BFPPayload, socket);
				break;
			default:
				require('./debug.js').log(1, 'backend', 'received unimplemented BFP message: ' + msg);
		}
	} else {
		require('./debug.js').log(4, 'backend', 'received BFP message: ' + msg + ' - sending down to raspy over RCP');
	}
}

/**
 * executed on receiving event 'update_pending_arduino' from the front-end
 */
function onBFPUpdatePendingArduino(msg, socket) {
	var debug = require('./debug.js');
	var accountID = socket.session.email;
	var m = require('./mem.js');
	debug.log(5, 'backend', '[' + accountID + '] WS received event: update_pending_arduino with: ' + JSON.stringify(msg));
	if (msg.code == ALLOW_PENDING_ARD) {
		m.allowPendingArduino(accountID, msg.raspyID, msg.ardIP);
	} else if (msg.code == REMOVE_PENDING_ARD) {
		m.removePendingArduino(accountID, msg.raspyID, msg.ardIP);
	}
}

/**
 * executed on receiving event 'update_arduino' from the front-end
 */
function onBFPUpdateArduino(msg, socket) {
	var debug = require('./debug.js');
	var accountID = socket.session.email;
	var m = require('./mem.js');
	
	debug.log(5, 'backend', '[' + accountID + '] WS received event: update_arduino with: ' + JSON.stringify(msg));
	m.updateArduino(accountID, msg.raspyID, msg.ardID, msg.name);
}

/**
 * executed on receiving even 'device_update' from the front-end
 */
function onBFPDeviceUpdate(msg, socket) {
	var accountID = socket.session.email;
	require('./debug.js').log(5, 'backend', '[' + accountID + '] WS received event: device_settings with: ' + JSON.stringify(msg));
	var mem = components.getFacility('mem');
	var devices = mem.getClientDevices(accountID);
	var device = devices.raspys[msg.raspyID].arduinos[msg.ardID].devices[msg.devID];

	/* make the discovered device "undiscovered" so that once configured it disappears from the discovered devices page */
	if (device.discovered == true) {
		device.discovered = false;
	}
	
	device.desc = msg.desc;
	device.activated = msg.activated;
	require('./configdb.js').updateDevice(accountID, device);
	var bfp = require('./bfp.js');
	var BFPDeviceStatus = bfp.BFPCreateDeviceStatusFromMem(device);
	console.log(JSON.stringify(BFPDeviceStatus));
	var io = this.components.getFacility('backend').io;
	io.of('/iot').to(accountID).emit('device_status', BFPDeviceStatus);
	//socket.emit('device_status', BFPDeviceStatus);
}

/**
 * executed when the 'device_discovered' comes from the front-end
 */
function onBFPDeviceDiscovered(BFPDeviceDiscovered, socket) {
	var accountID = socket.session.email;
	require('./debug.js').log(5, 'backend', '[' + accountID + '] WS received event: device_discovered with: ' + JSON.stringify(BFPDeviceDiscovered));
	var mem = components.getFacility('mem');
	var devices = mem.getClientDevices(accountID);
	var device = devices.raspys[BFPDeviceDiscovered.body.raspyID].arduinos[BFPDeviceDiscovered.body.ardID].devices[BFPDeviceDiscovered.body.devID];

	device.discovered = true;
}

/**
 * executed when the 'device_ignore' comes from the front-end
 */
function onBFPDeviceIgnore(BFPDeviceIgnore, socket) {
	var accountID = socket.session.email;
	require('./debug.js').log(5, 'backend', '[' + accountID + '] WS received event: device_discovered with: ' + JSON.stringify(BFPDeviceIgnore));
	var mem = components.getFacility('mem');
	var devices = mem.getClientDevices(accountID);
	var device = devices.raspys[BFPDeviceIgnore.body.raspyID].arduinos[BFPDeviceIgnore.body.ardID].devices[BFPDeviceIgnore.body.devID];

	device.discovered = false;
}

/**
 * executed on received even 'device_command' from the front-end
 */
function onBFPDeviceCommand(BFPDeviceCommand, socket) {
	var accountID = socket.session.email;
	require('./debug.js').log(5, 'backend', '[' + accountID + '] WS received event: device_command with: ' + JSON.stringify(BFPDeviceCommand));
	var mem = components.getFacility('mem');
	var devices = mem.getClientDevices(accountID);
	var command = BFPDeviceCommand.header.command;
	var device = mem.getDeviceStatus(accountID, BFPDeviceCommand.body.raspyID, BFPDeviceCommand.body.ardID, BFPDeviceCommand.body.devID);
	//if (typeof(BFPDeviceCommand.body.position) != 'undefined') /* overwrite the position of the mem with the one from the BFP command */
	//	device.position = BFPDeviceCommand.body.position
	if (typeof(device) == 'undefined') {
		/* this situation normally shouldn't happen. It means that either someone is manipulating with the front end or the backend refreshed
		i. e. removed the device while it still exists on the front-end */
		require('./debug.js').log(1, 'backend', '[' + accountID + '] Received BFPDeviceCommand for unknown device! Doing nothing.');
		return;
	}
	BFPDeviceCommand.body.IP = device.IP;
	if (!require('./config.js').cloud.enabled) {
		require('./debug.js').log(5, 'backend', '[' + accountID + '] System working as raspy, sending command over ARiF');
		if (command == 'shadeTILT') {
			device.tilt = BFPDeviceCommand.body.tilt;
			console.log("Setting device's tilt");
		}
		require('./arif.js').sendCommand(BFPDeviceCommand.body, command, function(message) {
			//console.log('test ' + JSON.stringify(message));
			socket.emit('device_response', message);
		});
	} else {
		// send to appropriate raspy
		require('./debug.js').log(5, 'backend', '[' + accountID + '] TODO: System working as cloud, sending command over RCP');
	}
}

function onBFPDeleteArduino(msg, socket) {
	var accountID = socket.session.email;
	require('./debug.js').log(5, 'backend', '[' + accountID + '] WS received event: delete_arduino with: ' + JSON.stringify(msg));
	var mem = components.getFacility('mem');
	//var devices = mem.getClientDevices(accountID);
	var raspyID = msg.raspyID;
	var ardID = msg.ardID;
	
	mem.deleteArduino(accountID, raspyID, ardID);
}

/**
 * Validate user string input (for length, etc... TODO)
 */
function validateFrontendInput(input) {
	return input;
}

/**
 * pushes all device data to a socket identified by accountID
 */
function pushAllDevices(socket, accountID) {
	mem = components.getFacility('mem');
	devices = mem.getClientDevices(accountID);
	
	for (var raspyID in devices.raspys) {
		if (raspyID > 0 && raspyID < 999) { // control if variable is actually a raspyID or meta
			for (var ardID in devices.raspys[raspyID].arduinos) {
				if (ardID > 0 && ardID < 256) {
					for (var devID in devices.raspys[raspyID].arduinos[ardID].devices) {
						if (devID > 0 && devID < 256) {
							require('./debug.js').log(5, 'backend', '[' + accountID + '] Emitting device data of raspyID: ' + raspyID +
									' ardID: ' + ardID + ' devID: ' + devID);
							var BFPDeviceStatus = require('./bfp.js').BFPCreateDeviceStatusFromMem(devices.raspys[raspyID].arduinos[ardID].devices[devID]);
							socket.emit('device_status', BFPDeviceStatus);
						}
					}
				}
			}
		}
	}
}

/** 
 * Sends Cloud Status to the Front-End.
 */ 
function sendBFPCloudStatus(socket, accountID) {
	var config = require('./config.js');
	var debug = require('./debug.js');
	var host;
	var port;
	var vpnID;
	var BFPCloudStatus;

	if (config.cloud.connection) {
		status = require('./rcpclient.js').isCloudAlive;
		host = config.rcpclient.host;
		port = config.rcpclient.port;
		vpnID = config.rcpclient.vpnID;
		BFPCloudStatus = require('./bfp.js').BFPCreateCloudStatus(true, status, host, port, vpnID, null);
	} else {
		BFPCloudStatus = require('./bfp.js').BFPCreateCloudStatus(false);
	}
	
	socket.emit('cloud_status', BFPCloudStatus);
	debug.log(4, 'rcpclient', 'Emitting cloud status message: ' + JSON.stringify(BFPCloudStatus));
}

/**
 * pushes all arduino data to a socket identified by accountID
 */
function pushAllArduinos(socket, accountID) {
	mem = components.getFacility('mem');
	devices = mem.getClientDevices(accountID);
	
		for (var raspyID in devices.raspys) {
		if (raspyID > 0 && raspyID < 999) { // control if variable is actually a raspyID or meta
			for (var ardID in devices.raspys[raspyID].arduinos) {
				if (ardID > 0 && ardID < 256) {
							var arduino = {};
							arduino.ardID = ardID;
							if (typeof(devices.raspys[raspyID].arduinos[ardID].name) != 'undefined')
								arduino.name = devices.raspys[raspyID].arduinos[ardID].name;
							arduino.IP = devices.raspys[raspyID].arduinos[ardID].IP;
							arduino.alive = devices.raspys[raspyID].arduinos[ardID].alive;
							arduino.raspyID = devices.raspys[raspyID].arduinos[ardID].raspyID;
							
							require('./debug.js').log(5, 'backend', '[' + accountID + '] Emitting Arduino data of raspyID: ' + raspyID +
									' ardID: ' + ardID);
							socket.emit('arduino', arduino);

				}
			}
		}
	}
}


/**
 * Function exectued on closure of WS connection
 */
function onWSDisconnect(session) {
	email = session.email;
	require('./debug.js').log(5, 'backend', '[' + email + '] WS disconnected');
}
 
module.exports = backend;
