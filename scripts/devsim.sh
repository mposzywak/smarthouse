while true ; do 
	wget -qO- http://localhost:32300/ba/1/data/1wire/dec/$(( ( RANDOM % 30 )  + 1 )) > /dev/null
	sleep 3
	wget -qO- http://localhost:32300/ba/2/data/1wire/dec/$(( ( RANDOM % 30 )  + 1 )) > /dev/null
	sleep 1
	wget -qO- http://localhost:32300/10ba/1/data/i2c/dec/$(( ( RANDOM % 80 )  + 1 )) > /dev/null
	sleep 2
done

# /devID/ardID/cmd/devType/dataType/value
