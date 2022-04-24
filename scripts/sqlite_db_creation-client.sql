
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
    dataType VARCHAR(2),
    direction TEXT,
    tilt TEXT,
    position TEXT,
    tiltTimer TEXT,
    positionTimer TEXT,
    desc TEXT,
    sync NUMERIC,
    IP TEXT,
    activated NUMERIC,
    FOREIGN KEY (ardID) REFERENCES arduinos(ardID) ON DELETE CASCADE,
    FOREIGN KEY (raspyID) REFERENCES raspys(raspyID) ON DELETE CASCADE, 
    FOREIGN KEY (accountID) REFERENCES accounts(accountID) ON DELETE CASCADE, 
    PRIMARY KEY (devID, ardID, raspyID, accountID)
);



-- sample account creation with one raspy:
INSERT INTO accounts (accountID, name) VALUES ('admin', 'Initial Account');
UPDATE accounts SET 
    email = 'initial-account@velen.tech', 
    password = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 
    salt = '' WHERE accountid = 'admin';
INSERT INTO raspys (raspyID, accountID, vpnID, cloudService, remoteService, backupService) VALUES ('001', 'admin', '00000001-001', '0', '0', '0');
UPDATE raspys SET vpnKey = 'ffffffffffffffff' WHERE raspyID = '001' AND accountID = 'admin';


