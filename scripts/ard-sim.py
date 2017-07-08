import httplib



conn = httplib.HTTPConnection("localhost", "32300");
conn.putrequest("POST", "/0/0/a/")
conn.putheader("X-iot-dev", "1,1")
conn.endheaders()


#conn.endheaders()
#conn.send()

res = conn.getresponse()
print 'res =', res.status
print 'X-arduino :', res.getheader('X-arduino')
