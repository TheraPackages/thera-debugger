
var ip = require('ip');

module.exports = (function() {

  return {
    project: {
      root: __dirname
    },
    server: {
      host: 'localhost',
      ip: ip.address(),
      port: 8088
    },
    inspector: {

    },
    debugger: {
      host: 'localhost',
      ip: ip.address(),
      port: 8315
    }
  }

})();
