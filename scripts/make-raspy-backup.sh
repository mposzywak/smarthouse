#!/bin/sh
#
# Script used to copy raspy application backup into the appropriate directory.
# The backup archive can then be picked up by the cloud system.


# get VPNID from openvpn login file and create a directory for the backup if it doesn't exist
VPNID=`head -1 /etc/openvpn/user-pass`
if [ ! -d /home/$VPNID/velen-backup ] ; then
	mkdir /home/$VPNID/velen-backup
fi

# tmp folder, if it exists, remove it
TMP='/tmp/velen-backup/'
if [ -d $TMP ] ; then
	rm -rf $TMP
fi

# files to backup
SMARTHOUSEDB='/srv/smarthouse/db/iot.db'
HACONFS='/home/homeassistant/.homeassistant/'

# get the hass version
HAVER=`/srv/homeassistant/bin/python3 /srv/homeassistant/bin/hass --version`

# get current date and time
TODAY=`date '+%Y%m%d-%H%M'`

# remove old backups
rm -f /home/$VPNID/velen-backup/*.tar.gz
rm -f /home/$VPNID/velen-backup/*.sha1

# copy files into tempdir and compress
mkdir $TMP
cp -a $SMARTHOUSEDB $HACONFS $TMP
echo $HAVER >> $TMP/ha-version.txt
tar -cf /home/$VPNID/velen-backup/$VPNID-$TODAY.tar $TMP
gzip /home/$VPNID/velen-backup/$VPNID-$TODAY.tar

# calculate checksum for the backup file
sha1sum /home/$VPNID/velen-backup/$VPNID-$TODAY.tar.gz | awk '{print $1}' > /home/$VPNID/velen-backup/$VPNID-$TODAY.sha1