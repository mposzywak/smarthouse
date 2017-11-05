
const sqlite3 = require('sqlite3').verbose();

var ConfigDB = function() {
	this.components = require('./components').setFacility(this, 'configdb');
	this.debug = require('./debug.js');
	var debug = this.debug;
	this.db = new sqlite3.Database('/home/maciej/configdb/test.db', (err) => {
		if (err) {
			debug.log(1, 'configdb', 'Error while inserting new Arduino: ' + error.message);
		} else {
			debug.log(1, 'configdb', 'ConfigDB file opened succesfully');
		}
	//console.log('Connected to the configDB database.');
	});
}


/*
ConfigDB.prototype.getArdID = function(accountID, raspyID, ip) {
	sql = 'SELECT ardid FROM arduinos WHERE accountid = ? AND raspyid = ? AND ip = ?;';
	
	this.db.all(sql, [accountID, raspyID, ip], function (error, row) {
		if (error) {
			console.log('Error while executing DB query: ' + error.message);
		}
		if (row[0]) {
			console.log('result: ' + JSON.stringify(row));
		}
	});
} */

/**
 * inserts an Arduino in the DB. This would typically happen on registering new Arduino on the raspy,
 * or during receiving of device data on the cloud when there is no arduino defined in mem structure.
 */
ConfigDB.prototype.insertArduino = function(accountID, raspyID, IP, ardID) {
	var debug = this.debug;
	var sql = 'INSERT INTO arduinos (ardID, raspyID, accountID, IP) VALUES (?, ?, ?, ?)';
	
	this.db.run(sql, [ardID, raspyID, accountID, IP], function (error) {
		if (error) {
			debug.log(1, 'configdb', 'Error while inserting new Arduino: ' + error.message);
		} else {
			debug.log(5, 'configdb', 'Inserted Arduino, accountid: ' + accountID + ', raspyid: ' + 
					raspyID + ', IP: ' + IP + ', ardID: ' + ardID);
		}
	});
}

/**
 * Insert new device into the cloud. This would happen when first data from device arravies at either cloud or raspy.
 */
ConfigDB.prototype.insertDevice = function(accountID, device) {
	var debug = this.debug;
	var sql = 'INSERT INTO devices (devID, ardID, raspyID, accountID, devType, dataType, value, date, desc, activated, IP) \
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
	//console.log('-------------------------' + JSON.stringify(device));
	this.db.run(sql, [device.devID, device.ardID, device.raspyID, accountID, 
			device.devType, device.dataType, device.value, JSON.stringify(device.date), 
			device.desc, device.activated ? 1 : 0, device.IP], function (error) {
		if (error) {
			debug.log(1, 'configdb', 'Error while inserting new Device: ' + error.message);
		} else {
			debug.log(5, 'configdb', 'Inserted Device, accountid: ' + accountID + ', raspyid: ' + 
					device.raspyID + ', devID: ' + device.devID + ', ardID: ' + device.ardID);
		}
	});
}

/**
 * This should be executed when new data arrives for device that is already in present in mem, on both raspy or cloud.
 */
ConfigDB.prototype.updateDevice = function(accountID, device) {
	var debug = this.debug;
	sql = 'UPDATE devices SET value = ?, date = ?, desc = ?, ip = ?, activated = ? \
			WHERE devID = ? AND ardID = ? AND raspyID = ? AND accountID = ?'
	SQLUpdate = 'UPDATE devices SET ';
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
			case 'ardID':
			case 'devID':
			case 'raspyID':
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
 * Get all devices or single accountID, this should be executed on the raspy on startup, and on the cloud when:
 * a) client connects to web GUI
 * b) first data arrives over RCP and there is no mem structure for that accountID
 */
ConfigDB.prototype.getAllAccountDevices = function(accountID, callback) {
	var SQLDevices = 'SELECT * FROM devices WHERE accountID = ?';
	var SQLArduinos = 'SELECT * FROM arduinos WHERE accountID = ?';
	var db = this.db;
	var devices = {};
	
	db.all(SQLArduinos, [accountID], function(error, rows) {
		if (error) {
			callback(error, null);
		} else {
			for (var i = 0; i < rows.length; i++) {
				var row = rows[i];
				var raspyID = row.raspyID;
				var ardID = row.ardID;
				
				if (typeof(devices[raspyID]) == 'undefined') 
					devices[raspyID] = {};
				
				devices[raspyID][ardID] = {}
				devices[raspyID][ardID].IP = row.IP;
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
						if (typeof(devices[raspyID]) == 'undefined') 
							devices[raspyID] = {};
						if (typeof(devices[raspyID][ardID]) == 'undefined') 
							devices[raspyID][ardID] = {};
						
						devices[raspyID][ardID][devID] = {};
						devices[raspyID][ardID][devID].activated = row.activated ? true : false;
						devices[raspyID][ardID][devID].ardID = row.ardID;
						devices[raspyID][ardID][devID].dataType = row.dataType;
						devices[raspyID][ardID][devID].date = JSON.parse(row.date);
						devices[raspyID][ardID][devID].desc = row.desc;
						devices[raspyID][ardID][devID].devType = row.devType;
						devices[raspyID][ardID][devID].devID = row.devID;
						devices[raspyID][ardID][devID].IP = row.IP;
						devices[raspyID][ardID][devID].raspyID = row.raspyID;
						devices[raspyID][ardID][devID].value = row.value;
					}
					//console.log(JSON.stringify(devices));
					callback(error, devices);
				}
			});
		}
	});
}

var configdb = new ConfigDB();
module.exports = configdb;
