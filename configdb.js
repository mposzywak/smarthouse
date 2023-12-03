const sqlite3 = require('sqlite3').verbose();

var ConfigDB = function() {
	this.components = require('./components').setFacility(this, 'configdb');
	this.debug = require('./debug.js');
	this.config = require('./config.js');
	var debug = this.debug;
	this.db = new sqlite3.Database(this.config.configdb.dbfile, (err) => {
		if (err) {
			debug.log(1, 'configdb', 'Error while opening DB file: ' + err.message);
		} else {
			debug.log(1, 'configdb', 'ConfigDB file opened succesfully');
		}
		//console.log('Connected to the configDB database.');
	});
}

/**
 * (only cloud) function to add new account
 */

ConfigDB.prototype.insertAccount = function(accountID, name, email, password, salt) {

}

/**
 * (only cloud) function to add new raspy
 */

ConfigDB.prototype.insertRaspy = function(accountID, raspyID, vpnID, vpnKey, remote, backup) {

}

/**
 * (only Raspy) function returns vpnID value for the raspy, if it is not configured, returns null
 */
ConfigDB.prototype.getVpnID = function(accountID, raspyID, callback) {
	var debug = this.debug;
	var vpnID = accountID + '-' + raspyID
	
	var sql = 'SELECT vpnID, vpnKey, initVpnKey, cloudService FROM raspys WHERE accountID = ? AND raspyID = ?';

	this.db.all(sql, [accountID, raspyID], function(error, rows) {
		
		if (error) {
			callback(error, null);
			return;
		}
		if (rows.length == 0) {
			debug.logVPN(1, 'configdb', vpnID, 'DB row empty. accountID or raspyID not found in the DB.');
			callback(true, null);
			return;
		}
		for (var i = 0; i < rows.length; i++) {
			var row = rows[i];
			callback(null, row.vpnID, row.vpnKey, row.initVpnKey, row.cloud);
			return;
		}
	});
}

/**
 * (only Raspy) function sets the new vpnID and vpnKey (also changes raspyID in all devices and arduinos)
 */
ConfigDB.prototype.setVpnID = function(accountID, raspyID, enabled, vpnID, vpnKey, initVpnKey, initSetupFlag) {
	var debug = this.debug;
	sql = 'UPDATE raspys SET vpnID = ?, vpnKey = ?, cloudService = ? \
			WHERE accountID = ? AND raspyID ?'
	SQLUpdate = 'UPDATE raspys SET ';
	SQLWhere = ' WHERE raspyID = ? AND accountID = ?';
	values = [];

	if (typeof(enabled) != 'undefined') {
		SQLUpdate += ' cloudService = ?,';
		if (enabled)
			values.push(1);
		else
			values.push(0);
	}

	if (typeof(vpnID) != 'undefined') {
		SQLUpdate += ' vpnID = ?,';
		values.push(vpnID);
	}

	if (typeof(vpnKey) != 'undefined') {
		SQLUpdate += ' vpnKey = ?,';
		values.push(vpnKey);
	}

	if (typeof(initVpnKey) != 'undefined') {
		SQLUpdate += ' initVpnKey = ?,';
		values.push(initVpnKey);
	}

	if (typeof(initSetupFlag) != 'undefined') {
		SQLUpdate += ' initSetupFlag = ?,';
		if (initSetupFlag)
			values.push(1);
		else
			values.push(0);
	}


	SQLUpdate = SQLUpdate.substring(0, SQLUpdate.length - 1);

	values.push(raspyID);
	values.push(accountID);

	this.db.run(SQLUpdate + SQLWhere, values, function(error) {
		if (error) {
			debug.log(1, 'configdb', 'Error while updating Raspy with VPN details: ' + error.message);
		} else {
			debug.log(5, 'configdb', 'Updated Raspy with VPN details, accountid: ' + accountID + ', raspyid: ' + raspyID);
		}
	});
}


/**
 * inserts an Arduino in the DB. This would typically happen on registering new Arduino on the raspy,
 * or during receiving of device data on the cloud when there is no arduino defined in mem structure.
 */
ConfigDB.prototype.insertArduino = function(accountID, raspyID, IP, ardID, desc) {
	var debug = this.debug;
	var sql = 'INSERT INTO arduinos (ardID, raspyID, accountID, IP, desc) VALUES (?, ?, ?, ?, ?)';

	this.db.run(sql, [ardID, raspyID, accountID, IP, desc], function(error) {
		if (error) {
			debug.log(1, 'configdb', 'Error while inserting new Arduino: ' + error.message);
		} else {
			debug.log(5, 'configdb', 'Inserted Arduino, accountid: ' + accountID + ', raspyid: ' +
				raspyID + ', IP: ' + IP + ', ardID: ' + ardID + ', desc: ' + desc);
		}
	});
}

/**
 * Insert new device into the cloud. This would happen when first data from device arravies at either cloud or raspy.
 */
ConfigDB.prototype.insertDevice = function(accountID, device) {
	var debug = this.debug;
	var sql = 'INSERT INTO devices (devID, ardID, raspyID, accountID, devType, dataType, value, date, desc, activated, IP, extType) \
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
	var sqlShades = 'INSERT INTO shades (devID, ardID, raspyID, accountID, devType, position, tilt, sync, date, desc, activated, IP) \
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
	var sqlTemp = 'INSERT INTO devices (devID, ardID, raspyID, accountID, devType, dataType, value, date, desc, activated, IP) \
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
	debug.log(5, 'configdb', 'Inserting the following device into the DB: ' + JSON.stringify(device));

	if (device.devType == 'digitOUT') {
		this.db.run(sql, [device.devID, device.ardID, device.raspyID, accountID,
			device.devType, device.dataType, device.value, JSON.stringify(device.date),
			device.desc, device.activated ? 1 : 0, device.IP, device.extType
		], function(error) {
			if (error) {
				debug.log(1, 'configdb', 'Error while inserting new Device: ' + error.message);
			} else {
				debug.log(5, 'configdb', 'Inserted digitOUT Device, accountid: ' + accountID + ', raspyid: ' +
					device.raspyID + ', devID: ' + device.devID + ', ardID: ' + device.ardID);
			}
		});
	} else if (device.devType == 'temp') {
		this.db.run(sqlTemp, [device.devID, device.ardID, device.raspyID, accountID,
			device.devType, device.dataType, device.value, JSON.stringify(device.date),
			device.desc, device.activated ? 1 : 0, device.IP
		], function(error) {
			if (error) {
				debug.log(1, 'configdb', 'Error while inserting new Temperature Device: ' + error.message);
			} else {
				debug.log(5, 'configdb', 'Inserted Temperature Device, accountid: ' + accountID + ', raspyid: ' +
					device.raspyID + ', devID: ' + device.devID + ', ardID: ' + device.ardID);
			}
		});
	} else if (device.devType == 'shade') {
		let tilt;
		let sync;
		let position;

		if (typeof(device.tilt) == 'undefined')
			tilt = 0;
		else
			tilt = device.tilt;
		if (typeof(device.sync) == 'undefined')
			sync = 0;
		else
			sync = device.sync;
		if (typeof(device.position) == 'undefined')
			position = 0;
		else
			position = device.position;

		this.db.run(sqlShades, [device.devID, device.ardID, device.raspyID, accountID,
			device.devType, device.position, device.tilt, sync, JSON.stringify(device.date),
			device.desc, device.activated ? 1 : 0, device.IP
		], function(error) {
			if (error) {
				debug.log(1, 'configdb', 'Error while inserting new Shade Device: ' + error.message);
			} else {
				debug.log(5, 'configdb', 'Inserted Shade Device, accountid: ' + accountID + ', raspyid: ' +
					device.raspyID + ', devID: ' + device.devID + ', ardID: ' + device.ardID);
			}
		});
	} else {
		debug.log(1, 'configdb', 'Error while inserting new Device, unrecognized devType: ' + device.devType);
	}
}

/**
 * This should be executed when new data arrives for device that is already in present in mem, on both raspy or cloud.
 * Requires the following fields for digitIO and shades:
 *		device.ardID
 *		device.raspyID
 *		accountID
 *
 * Optional values for digitIO:
 *		device.activated
 *		device.IP
 *		device.desc
 *		device.date
 *		device.value
 *		device.devType
 *		device.dataType
 *		device.lightType
 *		device.lightInputType
 *		device.timer
 *		device.ctrlON
 *		device.extType
 *
 * Optional values for shades:
 *		device.activated
 *		device.IP
 *		device.desc
 *		device.date
 *		device.value
 *		device.devType
 *		device.dataType
 *		device.sync
 *		device.tilt
 *		device.position
 *		device.direction
 */
ConfigDB.prototype.updateDevice = function(accountID, device) {
	var debug = this.debug;
	let SQLUpdate;
	sql = 'UPDATE devices SET value = ?, date = ?, desc = ?, ip = ?, activated = ? WHERE devID = ? AND ardID = ? AND raspyID = ? AND accountID = ?';

	if (device.devType == 'shade') {
		SQLUpdate = 'UPDATE shades SET ';
	} else {
		SQLUpdate = 'UPDATE devices SET ';
	}
	SQLWhere = ' WHERE devID = ? AND ardID = ? AND raspyID = ? AND accountID = ?';
	values = [];
	for (key in device) {
		switch (key) {
			case 'activated':
				SQLUpdate += ' activated = ?,';
				values.push(device.activated ? 1 : 0);
				break;
			case 'IP':
				SQLUpdate += ' IP = ?,';
				values.push(device.IP);
				break;
			case 'desc':
				SQLUpdate += ' desc = ?,';
				values.push(device.desc);
				break;
			case 'date':
				SQLUpdate += ' date = ?,';
				values.push(JSON.stringify(device.date));
				break;
			case 'value':
				SQLUpdate += ' value = ?,';
				values.push(device.value);
				break;
			case 'devType':
				SQLUpdate += ' devType = ?,';
				values.push(device.devType);
				break;
			case 'dataType':
				SQLUpdate += ' dataType = ?,';
				values.push(device.dataType);
				break;
			case 'extType':
				SQLUpdate += ' extType = ?,';
				values.push(device.extType);
				break;
			case 'sync':
				SQLUpdate += ' sync = ?,';
				if (device.sync == true)
					values.push(true);
				else
					values.push(false);
				break;
			case 'tilt':
				SQLUpdate += ' tilt = ?,';
				values.push(device.tilt);
				break;
			case 'position':
				SQLUpdate += ' position = ?,';
				values.push(device.position);
				break;
			case 'positionTimer':
				SQLUpdate += ' positionTimer = ?,';
				values.push(device.positionTimer);
				break;
			case 'tiltTimer':
				SQLUpdate += ' tiltTimer = ?,';
				values.push(device.tiltTimer);
				break;
			case 'direction':
				SQLUpdate += ' direction = ?,';
				values.push(device.direction);
				break;
			case 'lightType':
				SQLUpdate += ' lightType = ?,';
				values.push(device.lightType);
				break;
			case 'lightInputType':
				SQLUpdate += ' lightInputType = ?,';
				values.push(device.lightInputType);
				break;
			case 'ctrlON':
				SQLUpdate += ' ctrlON = ?,';
				values.push(device.ctrlON);
				break;
			case 'timer':
				SQLUpdate += ' timer = ?,';
				values.push(device.timer);
				break;
			case 'ardID':
			case 'devID':
			case 'raspyID':
			case 'discovered':
			case 'alive': // there is no point in saving this, as it will be always updated real-time and on boot
				break;
			default:
				debug.log(1, 'configdb', 'Error while parsing device fields, implementation issue: ' + key);
		}
	}


	SQLUpdate = SQLUpdate.substring(0, SQLUpdate.length - 1);
	//console.log('query: ' + SQLUpdate + SQLWhere);

	values.push(device.devID);
	values.push(device.ardID);
	values.push(device.raspyID);
	values.push(accountID);
	//console.log('values: ' + values);
	this.db.run(SQLUpdate + SQLWhere, values, function(error) {
		if (error) {
			debug.log(1, 'configdb', 'Error while updating Device: ' + error.message);
		} else {
			debug.log(5, 'configdb', 'Updated Device, accountid: ' + accountID + ', raspyid: ' +
				device.raspyID + ', devID: ' + device.devID + ', ardID: ' + device.ardID);
		}
	});
}

/**
 * This function updates the Arduino information in the DB.
 * Requires the following fields:
 *		arduino.ardID
 *		arduino.raspyID
 *		accountID
 *
 * Optional values:
 *		arduino.IP
 *		arduino.desc
 *		arduino.date
 *		arduino.mac
 *		arduino.ctrlON
 *		arduino.mode
 */
ConfigDB.prototype.updateArduino = function(accountID, arduino) {
	var debug = this.debug;
	sql = 'UPDATE devices SET value = ?, date = ?, desc = ?, ip = ?, activated = ? \
			WHERE devID = ? AND ardID = ? AND raspyID = ? AND accountID = ?';
	SQLUpdate = 'UPDATE arduinos SET ';
	SQLWhere = ' WHERE ardID = ? AND raspyID = ? AND accountID = ?';
	values = [];
	for (key in arduino) {
		switch (key) {
			case 'IP':
				SQLUpdate += ' IP = ?,';
				values.push(arduino.IP);
				break;
			case 'desc':
				SQLUpdate += ' desc = ?,';
				values.push(arduino.desc);
				break;
			case 'date':
				SQLUpdate += ' date = ?,';
				values.push(JSON.stringify(arduino.date));
				break;
			case 'mac':
				SQLUpdate += ' mac = ?,';
				values.push(arduino.mac);
				break;
			case 'ctrlON':
				SQLUpdate += ' ctrlON = ?,';
				values.push(arduino.ctrlON);
				break;
			case 'mode':
				SQLUpdate += ' mode = ?,';
				values.push(arduino.mode);
				break;
			case 'version':
				SQLUpdate += ' version = ?,';
				values.push(arduino.version);
				break;
			case 'ardID':
			case 'raspyID':
			case 'counter':
			case 'alive': // there is no point in saving this, as it will be always updated real-time and on boot
				break;
			default:
				debug.log(1, 'configdb', 'Error while parsing arduino fields, implementation issue: ' + key);

		}
	}
	/* remove the trailing comma */
	SQLUpdate = SQLUpdate.substring(0, SQLUpdate.length - 1);
	//console.log('query: ' + SQLUpdate + SQLWhere);

	values.push(arduino.ardID);
	values.push(arduino.raspyID);
	values.push(accountID);
	this.db.run(SQLUpdate + SQLWhere, values, function(error) {
		if (error) {
			debug.log(1, 'configdb', 'Error while updating Arduino: ' + error.message);
		} else {
			debug.log(5, 'configdb', 'Updated Arduino, accountid: ' + accountID + ', raspyid: ' +
				arduino.raspyID + ', ardID: ' + arduino.ardID);
		}
	});
}

/**
 * This function updates the Raspy. (cloud only)
 * Requires the following fields:
 *		raspy.raspyID
 * either:
 *		raspy.alive
 *		raspy.lastSeen
 */
ConfigDB.prototype.updateRaspy = function(accountID, raspy) {
	var debug = this.debug;
	sql = 'UPDATE raspys SET alive = ?, lastSeen = ? \
			WHERE raspyID = ? AND accountID = ?';
	SQLUpdate = 'UPDATE raspys SET ';
	SQLWhere = ' WHERE raspyID = ? AND accountID = ?';
	values = [];
	for (key in raspy) {
		switch (key) {
			case 'alive':
				SQLUpdate += ' alive = ?,';
				if (raspy.alive)
					values.push(1);
				else
					values.push(0)
				break;
			case 'lastSeen':
				SQLUpdate += ' lastSeen = ?,';
				values.push(raspy.lastSeen);
				break;
			case 'raspyID':
				break;
			default:
				debug.log(1, 'configdb', 'Error while parsing raspy fields, implementation issue: ' + key);
		}
	}
	
	/* remove the trailing comma */
	SQLUpdate = SQLUpdate.substring(0, SQLUpdate.length - 1);
	
	values.push(raspy.raspyID);
	values.push(accountID);
	
	this.db.run(SQLUpdate + SQLWhere, values, function(error) {
		if (error) {
			debug.log(1, 'configdb', 'Error while updating Raspy: ' + error.message);
		} else {
			debug.log(5, 'configdb', 'Updated raspy, accountid: ' + accountID + ', raspyid: ' + raspy.raspyID);
		}
	});
}

/**
* This function delete the device information in the DB.
* Requires the following fields:
*		device.ardID
*		device.raspyID
*		device.devID
*		device.devType (either set to 'digitOUT' or 'shade')
*		accountID
*/
ConfigDB.prototype.deleteDevice = function(accountID, device) {
	var debug = this.debug;
	var SQLDeviceDelete = 'DELETE FROM devices WHERE devID = ? AND ardID = ? AND raspyID = ? AND accountID = ?';
	let SQLShadeDelete = 'DELETE FROM shades WHERE devID = ? AND ardID = ? AND raspyID = ? AND accountID = ?';
	var values = [];
	var db = this.db;
	
	values.push(device.devID)
	values.push(device.ardID);
	values.push(device.raspyID);
	values.push(accountID);
	
	if (device.devType == 'digitOUT') {
		db.run(SQLDeviceDelete, values, function(error) {
			if (error) {
				debug.log(1, 'configdb', 'Error while deleting light Device: ' + device.devID + ' Error: ' + error.message);
			} else {
				debug.log(5, 'configdb', 'Deleted device: ' + device.devID + ', ardID: ' + device.ardID);
			}
		});
	} else if (device.devType == 'shade') {
		db.run(SQLShadeDelete, values, function(error) {
			if (error) {
				debug.log(1, 'configdb', 'Error while deleting shade Device: ' + device.devID + ' Error: ' + error.message);
			} else {
				debug.log(5, 'configdb', 'Deleted device: ' + device.devID + ', ardID: ' + device.ardID);
			}
		});
	} else {
		debug.log(1, 'configdb', 'Incorrect devType used to delete a device: : ' + device.devType);
	}
	
}

ConfigDB.prototype.deleteArduino = function(accountID, arduino) {
	var debug = this.debug;
	var SQLArduinoDelete = 'DELETE FROM arduinos WHERE ardID = ? AND raspyID = ? AND accountID = ?';
	var SQLDevicesDelete = 'DELETE FROM devices WHERE ardID = ? AND raspyID = ? AND accountID = ?';
	let SQLShadesDelete = 'DELETE FROM shades WHERE ardID = ? AND raspyID = ? AND accountID = ?';
	var values = [];
	var db = this.db;

	values.push(arduino.ardID);
	values.push(arduino.raspyID);
	values.push(accountID);

	//console.log('values: ' + values);
	db.run(SQLDevicesDelete, values, function(error) {
		if (error) {
			debug.log(1, 'configdb', 'Error while deleting Arduino\'s devices: ' + error.message);
		} else {
			debug.log(5, 'configdb', 'Deleted Arduino\'s devices, accountid: ' + accountID + ', raspyid: ' +
				arduino.raspyID + ', ardID: ' + arduino.ardID);
			db.run(SQLShadesDelete, values, function(error) {
				if (error) {
					debug.log(1, 'configdb', 'Error while deleting Arduino\'s shades: ' + error.message);
				} else {
					debug.log(5, 'configdb', 'Deleted Arduino\'s shades, accountid: ' + accountID + ', raspyid: ' +
						arduino.raspyID + ', ardID: ' + arduino.ardID);
					db.run(SQLArduinoDelete, values, function(error) {
						if (error) {
							debug.log(1, 'configdb', 'Error while deleting Arduino: ' + error.message);
						} else {
							debug.log(5, 'configdb', 'Deleted Arduino, accountid: ' + accountID + ', raspyid: ' +
								arduino.raspyID + ', ardID: ' + arduino.ardID);
						}
					});
				}
			});
		}
	});
}

/**
 * Get all devices or single accountID, this should be executed on the raspy on startup, and on the cloud when:
 * a) client connects to web GUI
 * b) first data arrives over RCP and there is no mem structure for that accountID
 */
ConfigDB.prototype.getAllAccountDevices = function(accountID, callback) {
	var debug = this.debug;
	
	let SQLShades = 'SELECT * FROM shades WHERE accountID = ?';
	var SQLDevices = 'SELECT * FROM devices WHERE accountID = ?';
	var SQLArduinos = 'SELECT * FROM arduinos WHERE accountID = ?';
	var SQLRaspys = 'SELECT * FROM raspys WHERE accountID = ?';

	var db = this.db;
	var raspys = {};
	db.all(SQLRaspys, [accountID], function(error, rows) {
		if (error) {
			callback(error, null);
		} else {
			for (var i = 0; i < rows.length; i++) {
				var row = rows[i];
				raspys[row.raspyID] = {};
				raspys[row.raspyID].vpnKey = row.vpnKey;
				raspys[row.raspyID].vpnID = row.vpnID;
				if (row.cloudService == '1')
					raspys[row.raspyID].cloud = true;
				else
					raspys[row.raspyID].cloud = false;
				raspys[row.raspyID].arduinos = {};
			}
			db.all(SQLArduinos, [accountID], function(error, rows) {
				if (error) {
					callback(error, null);
				} else {
					for (var i = 0; i < rows.length; i++) {
						var row = rows[i];
						var raspyID = row.raspyID;
						var ardID = row.ardID;
						var desc = row.desc;

						if (typeof(raspys[raspyID]) == 'undefined') {
							raspys[raspyID] = {};
							raspys[raspyID].arduinos = {};
						}

						raspys[raspyID].arduinos[ardID] = {}
						raspys[raspyID].arduinos[ardID].devices = {}
						raspys[raspyID].arduinos[ardID].IP = row.IP;
						raspys[raspyID].arduinos[ardID].raspyID = raspyID;
						raspys[raspyID].arduinos[ardID].desc = desc;
						raspys[raspyID].arduinos[ardID].mac = row.mac;
						raspys[raspyID].arduinos[ardID].ctrlON = row.ctrlON;
						raspys[raspyID].arduinos[ardID].mode = row.mode;
					}

					db.all(SQLDevices, [accountID], function(error, rows) {
						if (error) {
							callback(error, null);
						} else {
							for (var i = 0; i < rows.length; i++) {
								var row = rows[i];
								var raspyID = row.raspyID;
								var ardID = row.ardID;
								var devID = row.devID;
								if (typeof(raspys[raspyID]) == 'undefined') {
									raspys[raspyID] = {};
									raspys[raspyID].arduinos = {};
								}
								if (typeof(raspys[raspyID].arduinos[ardID]) == 'undefined') {
									raspys[raspyID].arduinos[ardID] = {};
									raspys[raspyID].arduinos[ardID].devices = {};
									raspys[raspyID].arduinos[ardID].alive = false;
								}
								raspys[raspyID].arduinos[ardID].devices[devID] = {};
								raspys[raspyID].arduinos[ardID].devices[devID].activated = row.activated ? true : false;
								raspys[raspyID].arduinos[ardID].devices[devID].ardID = row.ardID;
								raspys[raspyID].arduinos[ardID].devices[devID].dataType = row.dataType;
								raspys[raspyID].arduinos[ardID].devices[devID].date = JSON.parse(row.date);
								raspys[raspyID].arduinos[ardID].devices[devID].desc = row.desc;
								raspys[raspyID].arduinos[ardID].devices[devID].devType = row.devType;
								raspys[raspyID].arduinos[ardID].devices[devID].devID = row.devID;
								raspys[raspyID].arduinos[ardID].devices[devID].IP = row.IP;
								raspys[raspyID].arduinos[ardID].devices[devID].raspyID = row.raspyID;
								raspys[raspyID].arduinos[ardID].devices[devID].value = row.value;
								raspys[raspyID].arduinos[ardID].devices[devID].alive = false;
								raspys[raspyID].arduinos[ardID].devices[devID].lightType = row.lightType;
								raspys[raspyID].arduinos[ardID].devices[devID].lightInputType = row.lightInputType
								raspys[raspyID].arduinos[ardID].devices[devID].timer = row.timer;
								raspys[raspyID].arduinos[ardID].devices[devID].ctrlON = row.ctrlON;
								raspys[raspyID].arduinos[ardID].devices[devID].extType = row.extType;
								debug.log(5, 'configdb', 'Reading device from DB: ' + JSON.stringify(raspys[raspyID].arduinos[ardID].devices[devID]));
							}
							//console.log(JSON.stringify(devices));
							//callback(error, raspys);
						}

						db.all(SQLShades, [accountID], function(error, rows) {
							if (error) {
								callback(error, null);
							} else {
								for (var i = 0; i < rows.length; i++) {
									var row = rows[i];
									var raspyID = row.raspyID;
									var ardID = row.ardID;
									var devID = row.devID;
									if (typeof(raspys[raspyID]) == 'undefined') {
										raspys[raspyID] = {};
										raspys[raspyID].arduinos = {};
									}
									if (typeof(raspys[raspyID].arduinos[ardID]) == 'undefined') {
										raspys[raspyID].arduinos[ardID] = {};
										raspys[raspyID].arduinos[ardID].devices = {};
										raspys[raspyID].arduinos[ardID].alive = false;
									}
									raspys[raspyID].arduinos[ardID].devices[devID] = {};
									raspys[raspyID].arduinos[ardID].devices[devID].activated = row.activated ? true : false;
									raspys[raspyID].arduinos[ardID].devices[devID].ardID = row.ardID;
									raspys[raspyID].arduinos[ardID].devices[devID].dataType = row.dataType;
									raspys[raspyID].arduinos[ardID].devices[devID].date = JSON.parse(row.date);
									raspys[raspyID].arduinos[ardID].devices[devID].desc = row.desc;
									raspys[raspyID].arduinos[ardID].devices[devID].devType = row.devType;
									raspys[raspyID].arduinos[ardID].devices[devID].devID = row.devID;
									raspys[raspyID].arduinos[ardID].devices[devID].IP = row.IP;
									raspys[raspyID].arduinos[ardID].devices[devID].raspyID = row.raspyID;
									raspys[raspyID].arduinos[ardID].devices[devID].tilt = row.tilt;
									raspys[raspyID].arduinos[ardID].devices[devID].position = row.position;
									raspys[raspyID].arduinos[ardID].devices[devID].sync = row.sync ? true : false;
									raspys[raspyID].arduinos[ardID].devices[devID].alive = false;
									raspys[raspyID].arduinos[ardID].devices[devID].positionTimer = row.positionTimer;
									raspys[raspyID].arduinos[ardID].devices[devID].tiltTimer = row.tiltTimer;
									debug.log(5, 'configdb', 'Reading shade from DB: ' + JSON.stringify(raspys[raspyID].arduinos[ardID].devices[devID]));
								}
								//console.log(JSON.stringify(devices));
								callback(error, raspys);
							}
						});
					});
					/**/
				}
			});
		}
	});
}


ConfigDB.prototype.getEverything = function(callback) {
	var SQLAccounts = 'SELECT * FROM accounts';
	var db = this.db;
	var accounts = {};

	db.all(SQLAccounts, [], function(error, rows) {
		if (error) {
			callback(error, null);
		} else {
			for (var i = 0; i < rows.length; i++) {
				var row = rows[i];
				let accountID = row.accountID;
				var name = row.name;
				var email = row.email;
				var password = row.password;

				accounts[accountID] = {};
				accounts[accountID].raspys = {};
				accounts[accountID].name = name;
				accounts[accountID].email = email;
				accounts[accountID].password = password;
				require('./configdb.js').getAllAccountDevices(accountID, function(error, raspys) {
					if (error) {
						callback(error);
					} else {
						accounts[accountID].raspys = raspys;
					}
				});
			}
			callback(null, accounts);
		}
	});
}

var configdb = new ConfigDB();
module.exports = configdb;
