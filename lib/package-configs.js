
module.exports = (function() {

  return {
    project: {
      root: __dirname
    },
    server: {
      host: 'localhost',
      port: 8088          // Initial port.
    },
    inspector: {
      host: 'localhost',
      port: -1            // Port used to connect server.
    },
    debugger: {
      host: 'localhost',
      port: 8315          // Target runtime
    }
  }

})();
