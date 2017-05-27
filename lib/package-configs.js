'use strict'

const DEBUG_PORT_KEY = 'thera-debugger.DebugServerPort';

module.exports = (function() {

  var debugPort = atom.config.get(DEBUG_PORT_KEY) || 8088;
  if (debugPort != atom.config.get(DEBUG_PORT_KEY)) {
    atom.config.set(DEBUG_PORT_KEY, debugPort)
  }

  return {
    project: {
      root: __dirname
    },
    server: {
      host: 'localhost',
      port: debugPort     // Initial port.
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
