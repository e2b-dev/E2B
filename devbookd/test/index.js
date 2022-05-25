const http = require('http');

const requestListener = function (req, res) {
  res.writeHead(200);
  res.end('Hello, World!');
}

const server = http.createServer(requestListener);
// This will create a HTTP server listening on 8123
server.listen(8123, () => console.log('Listening on 8123'));