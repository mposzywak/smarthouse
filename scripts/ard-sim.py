import httplib

arduino = { 'id' : '0', 'devs' : { '1' : 1, '2' : 1}};

def createArduino(arduino):
	conn = httplib.HTTPConnection("localhost", "32300");
	conn.putrequest("POST", "/0/0/a/")
	for devid, type in arduino['devs'].iteritems():
		conn.putheader("X-iot-dev", devid + "," + str(type))
	conn.putheader("X-iot-dev", "2,1")
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

def deviceSendStatus(arduino, devid):
	conn = httplib.HTTPConnection("localhost", "32300")
	conn.putrequest("POST", "/" + str(devid) + "/" + arduino['id'] + "/40/1/1/0")
	conn.endheaders()

	res = conn.getresponse()
	print 'result code :', res.status
	
	if res.status == 200:
		return True
	else: 
		return False


		
if (createArduino(arduino)):
	print 'registered succesfully with ardid:', arduino['id']
	for devid, type in arduino['devs'].iteritems():
		print 'Sending status for devid:', devid 
		deviceSendStatus(arduino, devid)
else:
	print 'Couldn\'t register arduino'

