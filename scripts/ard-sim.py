import httplib

arduino = { 'id' : '0', 'destip' : '37.46.83.239', 'devs' : { '1' : 1, '2' : 1, '3' : 2}};

# Arduino device mapping
mapping = { '1' : ['0'], '2' : ['0'], '3' : ['1', '2']};

def createArduino(arduino, destip):
	conn = httplib.HTTPConnection(destip, "32302");
	conn.putrequest("POST", "/0/0/a/")
	for devid, type in arduino['devs'].iteritems():
		conn.putheader("X-iot-dev", devid + "," + str(type))
	#conn.putheader("X-iot-dev", "2,1")
	conn.endheaders()

	res = conn.getresponse()
	print 'result code :', res.status
	
	if res.status == 200:
		ardid = res.getheader('X-arduino')
		arduino['id'] = ardid
		print 'X-arduino :', ardid
		return ardid
	else:
		return False

def deviceSendStatus(arduino, destip, devid):
	conn = httplib.HTTPConnection(destip, "32302")
	conn.putrequest("POST", "/" + str(devid) + "/" + arduino['id'] + "/40/1/1/1")
	conn.endheaders()

	res = conn.getresponse()
	print 'result code :', res.status
	
	if res.status == 200:
		return True
	else: 
		return False

def deviceSendMapping(arduino, destip, devid):
	conn = httplib.HTTPConnection(destip, "32302")
	if mapping[devid][0] == '0':
		controlled = '';
	else:
		print 'controlled: ', mapping[devid]
		controlled = ''
		for i in mapping[str(devid)]:
			controlled += '/' + i;
	conn.putrequest("POST", "/" + str(devid) + "/" + arduino['id'] + "/32/" + str(arduino['devs'][devid]) + controlled)
	conn.endheaders()
	res = conn.getresponse()
	print 'mapping sent for device: ', str(devid), 'result code :', res.status
	
	if res.status == 200:
		return True
	else: 
		return False
		
if (createArduino(arduino, arduino['destip'])):
	print 'registered succesfully with ardid:', arduino['id']
	for devid, type in arduino['devs'].iteritems():
		print 'Sending mapping for devid:', devid 
		deviceSendMapping(arduino, arduino['destip'], devid)
else:
	print 'Couldn\'t register arduino'

