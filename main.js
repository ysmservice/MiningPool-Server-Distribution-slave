const net = require('net');

const mainServerHost = 'localhost';
const mainServerPort = 15299;
const listenPorts = [15000, 15001, 15002]; // ここにリッスンしたいポートを追加
const minerSockets = {};
const mainServerSockets = {};

listenPorts.forEach(port => {
  const receiverServer = net.createServer((socket) => {
    const minerIdentifier = `${socket.remoteAddress}:${socket.remotePort}`;

    minerSockets[minerIdentifier] = socket;

    if (!mainServerSockets[minerIdentifier]) {
      const mainServerSocket = new net.Socket();
      mainServerSocket.connect(mainServerPort, mainServerHost, () => {
        console.log('Connected to main server from port', port);
        mainServerSockets[minerIdentifier] = mainServerSocket;
      });

      mainServerSocket.on('error', (err) => {
        console.error(`Main server socket error: ${err}`);
        delete mainServerSockets[minerIdentifier];
      });

      mainServerSocket.on('close', () => {
        delete mainServerSockets[minerIdentifier];
        if (minerSockets[minerIdentifier]) {
          minerSockets[minerIdentifier].end();
        }
      });

      mainServerSocket.on('data', (mainData) => {
        try {
          const message = JSON.parse(mainData.toString('utf-8'));
          if (minerSockets[message.minerIdentifier]) {
            minerSockets[message.minerIdentifier].write(message.data);
          }
        } catch (err) {
          console.error(`Received data from main server is not valid JSON: ${mainData.toString('utf-8')}`);
        }
      });
    }

    socket.on('data', (data) => {
      const message = JSON.stringify({ minerIdentifier, data: data.toString('utf-8'), port });
      if (mainServerSockets[minerIdentifier]) {
        mainServerSockets[minerIdentifier].write(message);
      }
    });

    socket.on('error', (err) => {
      console.error(`Miner socket error: ${err}`);
    });

    socket.on('close', () => {
      delete minerSockets[minerIdentifier];
      if (mainServerSockets[minerIdentifier]) {
        mainServerSockets[minerIdentifier].end();
      }
    });
  });

  receiverServer.listen(port, '0.0.0.0', () => {
    console.log(`Receiver server is listening on port ${port}`);
  });

  receiverServer.on('error', (err) => {
    console.error(`Receiver server error on port ${port}: ${err}`);
  });
});
