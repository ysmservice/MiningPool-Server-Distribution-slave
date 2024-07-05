const net = require('net');

const mainServerHost = 'localhost';
const mainServerPort = 15299;
const listenPorts = [15000, 15001, 15002]; // ここにリッスンしたいポートを追加
const minerSockets = {};

listenPorts.forEach(port => {
  const receiverServer = net.createServer((socket) => {
    const minerIdentifier = `${socket.remoteAddress}:${socket.remotePort}`;

    minerSockets[minerIdentifier] = socket;
    const mainServerSocket = new net.Socket();
    mainServerSocket.connect(mainServerPort, mainServerHost, () => {
      console.log('Connected to main server from port', port);
    });

    socket.on('data', (data) => {
      const message = JSON.stringify({ minerIdentifier, data: data.toString('utf-8'), port });
      mainServerSocket.write(message);
    });

    mainServerSocket.on('data', (mainData) => {
      const message = JSON.parse(mainData.toString('utf-8'));
      if (minerSockets[message.minerIdentifier]) {
        minerSockets[message.minerIdentifier].write(message.data);
      }
    });

    socket.on('close', () => {
      delete minerSockets[minerIdentifier];
      mainServerSocket.end();
    });

    mainServerSocket.on('close', () => {
      delete minerSockets[minerIdentifier];
      socket.end();
    });
  });

  receiverServer.listen(port, '0.0.0.0', () => {
    console.log(`Receiver server is listening on port ${port}`);
  });
});
