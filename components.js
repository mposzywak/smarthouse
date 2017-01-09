/*
 * components is an array that holds all the module objects in it's table, 
 * making them accessible through the getFacility().
 * in each constructor there should be e. g:
 *
 * this.components = require('./components').setFacility(this, 'mem');
 *
 * in order to put itself into the array, so that other facilities
 * may have access to it.
 * 
 */


var Components = function() {
	this.components = {};
}

var components = new Components();

/* get the requested facility object */
Components.prototype.getFacility = function(facility) {
	return this.components[facility];
}

/* put an object into the array 
 * This function normally would be called in a constructor and the 
 * first argument would be the object itself (this)
 */
Components.prototype.setFacility = function(facility, name) {
	this.components[name] = facility;
	return this;
}

module.exports = components;