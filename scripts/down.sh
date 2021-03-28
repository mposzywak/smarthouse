#!/bin/sh

echo DOWN > /etc/openvpn/connection-status

# send POST information to smarthouse through ARiF
/usr/bin/wget -qO- --method=POST 127.0.0.1:32302/vpn/down > /dev/null 2>&1

exit 0
