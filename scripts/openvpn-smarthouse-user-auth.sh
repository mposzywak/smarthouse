#!/bin/sh
#
#

# tag for logging into syslog
TAG=openvpn-smarthouse-user-auth

# DB file with username and paswords
DB=/home/maciej/configdb/cloud.db

# Get the initial setup flag
SQL_ISF=`sqlite3 -line $DB "SELECT initSetupFlag FROM raspys WHERE vpnID = '$username';" | awk '{print $3}'`

# Check if the vpnID exists in the DB, if not - exit.
if [ -z $SQL_ISF ] ; then
   logger -t $TAG Initial password authentication failure for accountID: $username. No such vpnID found in DB.
   exit 1
fi

# if:
#   1 - then use initVpnKey unless time initVpnKeyValidityTime is not exceeded
#   0 - then use vpnKey
if [ $SQL_ISF -eq 1 ] ; then
   SQL_IVKVT=`sqlite3 -line $DB "SELECT initVpnKeyValidityTime FROM raspys WHERE vpnID = '$username';" | awk '{print $3 " " $4}'`
   TIME_NOW=`date +%s`
   SQL_IVKVT_S=`date -d "$SQL_IVKVT" +%s`
   if [ $TIME_NOW -gt $SQL_IVKVT_S ] ; then
      logger -t $TAG Initial password authentication failure for accountID: $username. Passed vpnKey validity time.
      exit 1
   else 
      SQL_IVK=`sqlite3 -line $DB "SELECT initVpnKey FROM raspys WHERE vpnID = '$username';" | awk '{print $3}'`
      if [ $SQL_IVK == $password ] ; then
         logger -t $TAG Succesful initial Password authentication for account ID: $username, allowing connection. Generating vpnKey.
         NEW_VK=`openssl rand -hex 8`
         sqlite3 $DB "UPDATE raspys SET vpnKey = '$NEW_VK' WHERE vpnID = '$username';"
         exit 0
      else
         logger -t $TAG Initial Password authentication failure for account ID: $username, rejecting connection
         exit 1
      fi
   fi
else 
   SQL_VK=`sqlite3 -line $DB "SELECT vpnKey FROM raspys WHERE vpnID = '$username';" | awk '{print $3}'`
   if [ $SQL_VK == $password ] ; then
      logger -t $TAG Succesful Password authentication for account ID: $username, allowing connection
      exit 0
   else
      SQL_IVK=`sqlite3 -line $DB "SELECT initVpnKey FROM raspys WHERE vpnID = '$username';" | awk '{print $3}'`
      if [ $SQL_IVK == $password ] ; then
         logger -t $TAG Password authentication failure for account ID: $username, used old initial vpnKey
      else
         logger -t $TAG Password authentication failure for account ID: $username, rejecting connection
      fi
      exit 1
   fi
fi

