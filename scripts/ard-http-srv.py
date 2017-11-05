#!/usr/bin/env python
"""
Very simple HTTP server in python.
Usage::
    ./dummy-web-server.py [<port>]
Send a GET request::
    curl http://localhost
Send a HEAD request::
    curl -I http://localhost
Send a POST request::
    curl -d "foo=bar&bin=baz" http://localhost
"""
from BaseHTTPServer import BaseHTTPRequestHandler, HTTPServer
import SocketServer
import httplib
import time

class S(BaseHTTPRequestHandler):
    def deviceSendStatus(self, destIP, destPort, devID, ardID, status):
        conn = httplib.HTTPConnection(destIP, destPort)
        conn.putrequest("POST", "/" + devID + "/" + ardID + "/40/1/1/" + status)
        conn.endheaders()
        
        res = conn.getresponse()
        print 'result code :', res.status
        
        if res.status == 200:
            return True
        else: 
            return False
    
    
    def _set_headers(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()

    def do_GET(self):
        self._set_headers()
        self.wfile.write("<html><body><h1>hi!</h1></body></html>")

    def do_HEAD(self):
        self._set_headers()
        
    def do_POST(self):
        # Doesn't do anything with posted data
	    #print 'POST received with URL: ', self.path
        devID = self.path.split('/')[1]
        ardID = self.path.split('/')[2]
        raspyID = self.path.split('/')[3]
        command = self.path.split('/')[4]
        sourceIP = self.client_address[0]
        sourcePort = self.client_address[1]
        self._set_headers()
        if command == '1':
            value = 1
        else:
            value = 0
        self.wfile.write("<html><body><h1>POST!</h1></body></html>")
        time.sleep(0.5)
        self.deviceSendStatus(sourceIP, "32302", devID, ardID, str(value))
        #print 'ardID: ', sourceIP
        
def run(server_class=HTTPServer, handler_class=S, port=32302):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print 'Starting httpd...'
    httpd.serve_forever()

if __name__ == "__main__":
    from sys import argv

    if len(argv) == 2:
        run(port=int(argv[1]))
    else:
        run()
