
-- DB initialization on Raspy:
-- 1. the accountid and raspyid need to be loaded into the database
-- 
-- v2. added table shades

-- various settings
.headers on
.mode column

-- delete tables
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS raspys;
DROP TABLE IF EXISTS arduinos;
DROP TABLE IF EXISTS devices;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS shades;

-- to enforce foreign key checks
PRAGMA foreign_keys = ON;

--
-- create tables
--

-- accounts tables (raspy & cloud)
CREATE TABLE accounts (
    accountID VARCHAR(8) NOT NULL PRIMARY KEY, 
    name TEXT, 
    email TEXT, 
    password TEXT, 
    salt TEXT
);

-- raspys table (raspy & cloud)
CREATE TABLE raspys (
    raspyID VARCHAR(3) NOT NULL, 
    accountID VARCHAR(8) NOT NULL,
    vpnKey TEXT,
    initVpnKey TEXT,
    initVpnKeyValidityTime TEXT,
    vpnID TEXT,
    initSetupFlag NUMERIC,
    IP TEXT,
    cloudService NUMERIC,
    remoteService NUMERIC,
    backupService NUMERIC,
    FOREIGN KEY (accountID) REFERENCES accounts(accountID) ON DELETE CASCADE, 
    PRIMARY KEY (raspyID, accountID)
);

-- arduinos table (raspy & cloud)
CREATE TABLE arduinos (
    ardID VARCHAR(4) NOT NULL,
    raspyID VARCHAR(3) NOT NULL,
    accountID VARCHAR(8) NOT NULL,
    IP TEXT,
    FOREIGN KEY (raspyID) REFERENCES raspys(raspyID) ON DELETE CASCADE, 
    FOREIGN KEY (accountid) REFERENCES accounts(accountID) ON DELETE CASCADE, 
    PRIMARY KEY (ardID, raspyID, accountID)
);

-- devices table (raspy & cloud)
CREATE TABLE devices (
    devID VARCHAR(4) NOT NULL,
    ardID VARCHAR(4) NOT NULL,
    raspyID VARCHAR(3) NOT NULL,
    accountID VARCHAR(8) NOT NULL,
    devType VARCHAR(2),
    dataType VARCHAR(2),
    value TEXT,
    date TEXT,
    desc TEXT,
    IP TEXT,
    activated NUMERIC,
	controlledDevs TEXT,
    FOREIGN KEY (ardID) REFERENCES arduinos(ardID) ON DELETE CASCADE,
    FOREIGN KEY (raspyID) REFERENCES raspys(raspyID) ON DELETE CASCADE, 
    FOREIGN KEY (accountID) REFERENCES accounts(accountID) ON DELETE CASCADE, 
    PRIMARY KEY (devID, ardID, raspyID, accountID)
);

-- events table (raspy & cloud)
CREATE TABLE shades (
    devID VARCHAR(4) NOT NULL,
    ardID VARCHAR(4) NOT NULL,
    raspyID VARCHAR(3) NOT NULL,
    accountID VARCHAR(8) NOT NULL,
    date TEXT,
    devType VARCHAR(2),
    direction TEXT,
    tilt VARCHAR(3),
    position VARCHAR(3),
    desc TEXT,
    sync NUMERIC,
    IP TEXT,
    activated NUMERIC,
    FOREIGN KEY (ardID) REFERENCES arduinos(ardID) ON DELETE CASCADE,
    FOREIGN KEY (raspyID) REFERENCES raspys(raspyID) ON DELETE CASCADE, 
    FOREIGN KEY (accountID) REFERENCES accounts(accountID) ON DELETE CASCADE, 
    PRIMARY KEY (devID, ardID, raspyID, accountID)
);

-- some test accounts
INSERT INTO accounts (accountID, name, email) VALUES ('00001002', 'Maciej Test 1', 'maciej.poszywak@gmail.com');
INSERT INTO accounts (accountID, name, email) VALUES ('00001005', 'Maciej Test 1', 'maciej.poszywak@gmail.com');

INSERT INTO accounts (accountID, name, email) VALUES ('00001010', 'Libor Test 1', 'libor.ballaty@gmail.com');

INSERT INTO raspys (raspyID, accountID, vpnKey, initVpnKey, initVpnKeyValidityTime, vpnID, cloudService, remoteService, backupService)
VALUES ('001', '00001002', '', '33e9bc2d515c7923', datetime('now', '+3 hour'), '00001002-001', '0', '0', '0');
INSERT INTO raspys (raspyID, accountID, vpnKey, initVpnKey, initVpnKeyValidityTime, vpnID, cloudService, remoteService, backupService) 
VALUES ('001', '00001005', '', '8045c09ffb3b2446', datetime('now', '+3 hour'), '00001005-001', '0', '0', '0');

