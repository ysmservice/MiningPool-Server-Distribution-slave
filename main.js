const net = require('net');

const mainServerHost = '113.150.233.75';
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
      mainServerSockets[minerIdentifier] = mainServerSocket;
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

      let buffer = '';

      mainServerSocket.on('data', (mainData) => {
        buffer += mainData.toString('utf-8');
        
        while (true) {
          let braceCount = 0;
          let endIndex = -1;
          
          for (let i = 0; i < buffer.length; i++) {
            if (buffer[i] === '{') braceCount++;
            if (buffer[i] === '}') braceCount--;
            if (braceCount === 0 && buffer[i] === '}') {
              endIndex = i + 1;
              break;
            }
          }

          if (endIndex === -1) break; // 完全なJSONメッセージがまだ来ていない

          const completeMessage = buffer.slice(0, endIndex);
          buffer = buffer.slice(endIndex);

          try {
            const message = JSON.parse(completeMessage);
            if (minerSockets[minerIdentifier]) {
              minerSockets[minerIdentifier].write(message.data);
              console.log(`Received data: ${message.data}`);
            }
          } catch (err) {
            console.error(`Received data from main server is not valid JSON: ${completeMessage}`);
          }
        }
      });
    }

    socket.on('data', (data) => {
      const message = JSON.stringify({ minerIdentifier, data: data.toString('utf-8'), port: port });
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
