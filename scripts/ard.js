
/* load the config file */
var config = require('./config.js');
var debug = require('./debug.js');
var arif = require('./arif.js');
var arduino = require('./devices.js');

var arguments = require('node-command-line-option');

/* ARiF commands */
const ARIF_HEARTBEAT = 'heartbeat';
const ARIF_LIGHTON = 'lightON';
const ARIF_LIGHTOFF = 'lightOFF';

/* default operational values */
const ARDID = '1';
const RASPYID = '001';
const RASPYIP = '192.168.254.1'

/* reading cmd args  */
options = arguments.getOptions();
for (var option in options) {
	switch (option) {
		case 'mode':
			setMode(options.mode, options.ardid, options.raspyid);
			break;
		case 'srcip':
			arif.setSourceIP(options.srcip);
			break;
		case 'ardid':
			//setArdID(options.ardid);
			break;
		case 'raspyid':
			break;
		case 'help':
			printHelp();
			break;
		default:
			console.log('Unknown option: ' + option + '. Existing');
			process.exit(1);
			break;
	}
}

arif.init();

/* create readline interface for interactive CLI */
var readline = require('readline');
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', onInput)

function onInput(line) {
	cmd = line.split(' ')[0]
	switch (cmd) {
		case 'help':
			printHelp();
			break;
		case 'show':
			showDevices(line);
			break;
		case 'toggle':
			toggleDevice(line);
			break;
		case 'exit':
			process.exit(0);
			break;
		default:
			console.log('unknown command: ' + cmd)
			break;
	}
}

function printHelp() {
	console.log(' ----== Commands ==---- \n\n');
	console.log(' help - \t\t\t print this help');
	console.log(' show - \t\t\t list all devices available');
	console.log(' toggle <devID> - \t\t toggle digital IN device');
	console.log(' exit - \t\t\t close program');
	console.log('\n\n');
}

function showDevices(line) {
	arduino.showDevices();
}

function toggleDevice(line) {
	var devID = line.split(' ')[1];
	var arif = require('./arif.js');
	var arduino = require('./devices.js');
	
	arduino.toggle(devID);
}

function setMode(mode, ardID, raspyID) {
	var newArdID = '1';
	var newRaspyID = '001';
	if (mode == 'fresh') {
		arif.setRegisterFlag(false);
		debug.log(2, 'arif', 'Setting mode to register as new Arduino');
	} else if (mode == 'registered') {
		arif.setRegisterFlag(true);
		if (typeof(ardID) != 'undefined')
			arif.ardID = ardID;
		else
			arif.ardID = newArdID;
		if (typeof(raspyID) != 'undefined')
			arif.raspyID = raspyID;
		else
			arif.raspyID = newRaspyID;
		debug.log(2, 'arif', 'Setting mode to already registered as raspyID: ' + 
				arif.raspyID + ', ardID: ' + arif.ardID);
	} else {
		console.log("unknown mode: " + mode);
		process.exit(2);
	}
}

function printHelp() {
	console.log('\n Options:');
	console.log('\t --mode=<mode> \t\t Select mode of operation. Available are:');
	console.log('\t\t\t\t\t - fresh - Arduino initiates beacon indicating desire to register')
	console.log('\t\t\t\t\t - registered - Arduino acts as registered \(ardID is taken from --ardid option\)');
	console.log('\t --ardid=<ardid> \t Sets the ardID value. Works only mode is set to \'registered\'. Default value is 1');
	console.log('\t --srcip=<IP> \t\t Sets the IP which the ard.js should use as the ARiF interface');
	
	console.log('\n');
	process.exit(1);
}
