/**
 * settings
 */
const ADD_EXEC = '/home/maciej/accountdb/add-account.sh';
const AUTH_EXEC = '/home/maciej/accountdb/verify-account.sh';

const LOGIN_PAGE = 'login2.html'

/* message codes */
	const ALLOW_PENDING_ARD = 0;
	const REMOVE_PENDING_ARD = 1;


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
//	this.decode 	= require('client-sessions').util.decode;
	this.config 	= require('./config.js');
	this.cookie 	= require('cookie-parser');
	var EventEmitter = require('events').EventEmitter;
	this.emitter      = new EventEmitter();
	
	this.fileStore = require('session-file-store')(this.session);
	// TODO: Remove the rethink DB cookie store configuration
	//this.RDBStore 	= require('express-session-rethinkdb')(this.session);
	//this.rdbStore   = new this.RDBStore(this.components.getFacility('config').backend.sessionStoreOptions);
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
/*	this.app.use(this.session({
		secret: 'fdsifoa4efioehfrafoeffjisaofew',
		saveUninitialized: true,
		resave: true, 
		store: this.rdbStore
	}));*/
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
	this.app.get('\/device-configuration-single', onDeviceConfigurationSingle);
	this.app.get('\/device-configuration-arduino', onDeviceConfigurationArduino);
	this.app.get('/device-discovery', onDeviceDiscovery);
	
	this.app.get('', onAnyHTML);       // redirect to login page on '/'
	//executed on login inforamtion
	this.app.post('/auth', onLogin);

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
		res.write('<h1>Please login first.</h1>');
		res.end('<a href='+'/'+'>Login</a>');
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
		res.write('<h1>Please login first.</h1>');
		res.end('<a href='+'/'+'>Login</a>');
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
		res.write('<h1>Please login first.</h1>');
		res.end('<a href='+'/'+'>Login</a>');
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
		res.write('<h1>Please login first.</h1>');
		res.end('<a href='+'/'+'>Login</a>');
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
		res.write('<h1>Please login first.</h1>');
		res.end('<a href='+'/'+'>Login</a>');
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
		res.write('<h1>Please login first.</h1>');
		res.end('<a href='+'/'+'>Login</a>');
	}
}

/**
 * Function executed on logout
 */
function onLogout(req,res) {
	req.session.destroy(function(err) {
		if(err){
			console.log(err);
		} else {
			res.redirect('/');
		}
	});
}

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
					socket.on('device_update', function (msg) {
						//console.log('device_activate received');
						onDeviceUpdate(msg, socket);
					});
					socket.on('device_command', function (msg) {
						onDeviceCommand(msg, socket);
					});
					socket.on('update_pending_arduino', function (msg) {
						onUpdatePendingArduino(msg, socket);
					});
					socket.on('update_arduino', function (msg) {
						onUpdateArduino(msg, socket);
					});
					socket.on('delete_arduino', function (msg) {
						onDeleteArduino(msg, socket);
					});
					next();
				} else {
					//socket.disconnect();
					require('./debug.js').log(5, 'backend', 'WS cookie received but no email associatiated, hence closing from: ' + source);
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

/**
 * executed on receiving event 'update_pending_arduino' from the front-end
 */
function onUpdatePendingArduino(msg, socket) {
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
function onUpdateArduino(msg, socket) {
	var debug = require('./debug.js');
	var accountID = socket.session.email;
	var m = require('./mem.js');
	
	debug.log(5, 'backend', '[' + accountID + '] WS received event: update_arduino with: ' + JSON.stringify(msg));
	m.updateArduino(accountID, msg.raspyID, msg.ardID, msg.name);
}

/**
 * executed on receiving even 'device_update' from the front-end
 */
function onDeviceUpdate(msg, socket) {
	var accountID = socket.session.email;
	require('./debug.js').log(5, 'backend', '[' + accountID + '] WS received event: device_update with: ' + JSON.stringify(msg));
	var mem = components.getFacility('mem');
	var devices = mem.getClientDevices(accountID);
	
	devices.raspys[msg.raspyID].arduinos[msg.ardID].devices[msg.devID].desc = msg.desc;
	devices.raspys[msg.raspyID].arduinos[msg.ardID].devices[msg.devID].activated = msg.activated;
	require('./configdb.js').updateDevice(accountID, devices.raspys[msg.raspyID].arduinos[msg.ardID].devices[msg.devID]);
	socket.emit('device', devices.raspys[msg.raspyID].arduinos[msg.ardID].devices[msg.devID]);
}

/**
 * executed on received even 'device_command' from the front-end
 */
function onDeviceCommand(msg, socket) {
	var accountID = socket.session.email;
	require('./debug.js').log(5, 'backend', '[' + accountID + '] WS received event: device_command with: ' + JSON.stringify(msg));
	var mem = components.getFacility('mem');
	var devices = mem.getClientDevices(accountID);
	var command = msg.command;
	var device = mem.getDeviceStatus(accountID, msg.device.raspyID, msg.device.ardID, msg.device.devID);
	if (!require('./config.js').cloud.enable) {
		require('./debug.js').log(5, 'backend', '[' + accountID + '] System working as raspy, sending command over ARiF');
		require('./arif.js').sendCommand(device, command, function(message) {
			console.log('test ' + JSON.stringify(message));
			socket.emit('device_response', message);
		});
	} else {
		// send to appropriate raspy
		require('./debug.js').log(5, 'backend', '[' + accountID + '] System working as raspy, sending command over ARiF');
	}
}

function onDeleteArduino(msg, socket) {
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
							socket.emit('device', devices.raspys[raspyID].arduinos[ardID].devices[devID]);
						}
					}
				}
			}
		}
	}
}

/**
 * pushes all device data to a socket identified by accountID
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
