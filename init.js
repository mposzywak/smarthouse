/*
 * The init facility keeps the status of duties that need to be performed.
 * When the last duty is executed succesfully the init facility executes 
 * a function.
 */
var Init = function() {
	this.inits = {}
	this.counter = 0;
	this.components = require('./components.js').setFacility(this, 'init');
	this.callback = function() {
		require('./debug.js').log(1, 'init', 'Initialization completed. Dummy function called, please us setCallback()');
	}
}

var init = new Init();

/* set new init, takes string */
Init.prototype.setInit = function(init) {
	this.inits[init] = true;
	this.counter += 1;
	require('./debug.js').log(2, 'init', 'Setting Init named: ' + init);
}

/* clear init named init, takes string */
Init.prototype.clearInit = function(init) {
	delete init[init];
	require('./debug.js').log(2, 'init', 'Clearing Init named: ' + init);
	this.counter -= 1;
	if (this.counter == 0) {
		this.callback();
	}
}

/* set custom callback function, otherwise dummy function from constructor will be called */
Init.prototype.setCallback = function(callback) {
	this.callback = callback
}

module.exports = init;