import socket
import os
from MainAlgo import MainFunction

socketLocation = "/tmp/socketConnection"
host = "localhost"
port = 3000

if(os.path.exists(socketLocation)):
    os.remove(socketLocation)

socketConnection = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

socketConnection.connect((host, port))
print("connection done!")

while True:
    data = self.sock.recv(10)
    
    data = data.decode()
    
    if(data == "start-run"):
        MainFunction(socketConnection)

    print("One run done!")
