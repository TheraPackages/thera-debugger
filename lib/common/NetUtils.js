
var ip = require('ip');
var tcpPortUsed = require('tcp-port-used');
var http = require('http')
var url = require('url');

module.exports.isPortInuse = function(port, callback) {
  tcpPortUsed.check(port, ip.address())
  .then(function(inUse) {
    callback(inUse);
  }, function(err) {
    console.error('Check PortInuse Error:', err.message);
    callback(true);
  });
}

module.exports.curl = function(curlUrl, callback) {
  var parsedUrl = url.parse(curlUrl);
  var option = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port,
    path: parsedUrl.path,
    method: 'GET'
  }
  var req = http.request(option, function(res) {
    var html = "";
    res.on('data', function(chunk) {
      html += chunk;
    });
    res.on('close', function() {
    });
    res.on('abort', function() {
    });
    res.on('end', function(e) {
      callback(null, html);
    });
  });
  req.on('error', function(err) {
    callback(err, null);
  });
  req.end();
}

module.exports.ip = function() {
  return ip.address();
}
