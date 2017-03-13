
var ip = require('ip');

module.exports = (function() {

  return {
    project: {
      root: __dirname
    },
    server: {
      host: 'localhost',
      ip: ip.address(),
      port: 8088          // Initial port.
    },
    inspector: {
      host: 'localhost',
      ip: ip.address(),
      port: -1            // Port used to connect server.
    },
    debugger: {
      host: 'localhost',
      ip: ip.address(),
      port: 8315          // Target runtime
    }
  }

})();
