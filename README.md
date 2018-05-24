
--- smarthouse ---

This is a simple node app containing a backend and a portal, for displaying
IoT devices

--- install ---

1. Download the content from Git:

   git clone git://github.com/mposzywak/smarthouse

2. Enter the created directory and install node.js packages using npm:

   cd smarthouse
   npm install

3. (Raspy only) Install multicast route:

   route add -net 224.0.0.0 netmask 240.0.0.0 <interface>

Where the <interface> is the NIC where the arduinos are going to be connected.

3. Start the node application:

   node ./iotpi.js

The server is listening by default on port 10080 

--- Configuration ---

The following settings can be adjusted before running the application:

config.cloud.enabled = <boolean> - decides whether operating mode is "raspy"
or "cloud" 


--- device simulation ---

To start simulation of the device open another terminal and execute:

cd scripts
./devsim.sh

# 
