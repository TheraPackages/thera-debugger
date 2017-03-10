
var ip = require('ip');

module.exports = (function() {

  return {
    server: {
      ip: ip.address(),
      port: 8088
    }
  }

})();
