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
	this.app.get('/', onAnyHTML);       // redirect to login page on '/'
	//executed on login inforamtion
	this.app.post('/auth', onLogin);

	this.app.get('/logout', onLogout);
	
	// setup the server for listening on the port
	this.server = this.http.createServer(this.app).listen(components.getFacility('config').backend.port || 80, onListen);
	this.io = require('socket.io').listen(this.server);
	this.io.of('/iot').use(onWSAuthorize);
	//this.io.of('/iot').on('disconnect', onWSDisconnect);
	this.server.on('error', onError);		// executed when cannot start the backend server
	
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
		res.render('login.html');
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
	if (verify(email, pass)) {
		require('./debug.js').log(5, 'backend', 'Correct login for: ' + email);
		req.session.email = email;
		res.header('Access-Control-Allow-Origin', 'http://duinocloud.com:10080/*');
		res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
		res.header('Access-Control-Allow-Headers', 'Content-Type');

		res.end('done');
	} else {
		// bad user or pass
		require('./debug.js').log(5, 'backend', 'Bad login for: ' + email);
		res.end('bad');
	}
}

/**
 * Load the administrative page upon succesfull login
 */
function onAdmin(req, res) {
	var sess = req.session;
	if(sess.email)	
	{
		res.render('index.html');
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
function verify(login, password) {
	// check if the username is in the config file
	id = components.getFacility('config').cloud.id;
	pass = components.getFacility('config').cloud.passwd;
	if (id && pass)
	{
		if (login === id && password === pass) {
			//login ok
			return true;
		}
	} else { // TODO: check DB for username
		
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
		console.log('ID = ' + id);
		backend.FILEStore.get(id, function(error, session) {
			if (error)
			{
				require('./debug.js').log(5, 'backend', 'Error while reading session data from DB for: ' + source + ' error: ' + error);
			} else {
				email = session.email;
				if (email) {
					require('./debug.js').log(5, 'backend', '[' + email + '] WS session established from: ' + source);
					socket.session = session;
					socket.on('disconnect', function() {
						onWSDisconnect(session);
					});
	
					socket.join(email);
					socket.session = session;
					pushAllDevices(socket, email);
					socket.on('device_activate', function (msg) {
						console.log('device_activate received');
						onDeviceActivate(msg, socket)
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
 * executed on receiving even 'device_activate' from the front-end
 */
function onDeviceActivate(msg, socket) {
	require('./debug.js').log(5, 'backend', 'WS received event: device_update, from client: ' + socket.session.email);
}

/**
 * pushes all device data to a socket identified by "client" ID
 */
function pushAllDevices(socket, client) {
	mem = components.getFacility('mem');
	devices = mem.getClientDevices(client);
	
	for (var ardid in devices) {
		for (var devid in devices[ardid]) {
			//below line will not work. Probably because we are executing this function inside 
			//initialization function
			//io.of('/iot').to(client).emit('value', devices[ardid][devid]);
			
			socket.emit('device', devices[ardid][devid]);
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
