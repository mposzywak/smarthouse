
/*
 * The init facility keeps the status of duties that need to be performed.
 * When the last duty is executed succesfully the init facility executes 
 * a function.
 */
var BFP = function() {
	this.components = require('./components.js').setFacility(this, 'bfp');
}

var bfp = new BFP();

/* set new init, takes string */
BFP.prototype.BFPValidateDevicecommand = function() {

}

BFP.prototype.BFPCreateDeviceStatus = function(raspyID, ardID, devID) {
	message = {};
	message.header = {};
	message.header.code = BFP_Device_Status;
	message.body = {};



	return message;
}



module.exports = bfp;