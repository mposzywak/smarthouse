
/* Debug facility initialization */
var Debug = function() {
	this.config = require('./config.js');
	//this.components = require('./components.js').setFacility(this, 'debug');
}

var debug = new Debug();


/* main logging function */
Debug.prototype.log = function(severity, facility, msg) {
	if (typeof(this.config[facility]) == 'undefined') {
		date = new Date();
		dateString = date.toString().split(' ').splice(1,4).join(' ') + ':' + date.getMilliseconds();
		console.log(dateString + ' Facility: ' + facility + ' is undefined. The log() function is called improperly');
	} else {
		if (this.config[facility].debug >= severity) {
			date = new Date();
			dateString = date.toString().split(' ').splice(1,4).join(' ') + ':' + date.getMilliseconds();
			console.log(dateString + ' [' + facility + ': ' + severity + ' ] ' + msg);
		}
	}
}



module.exports = debug;
