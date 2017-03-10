
/**
 * @param {DebuggerManager} debuggerManager
 */
TheDebugger.DeviceManagerClass = function() {
  this._connected = false;
  this._messageId = 1;
  this._deviceList = [];

  this._messageMap = {
      "WxDebug.pushDeviceList": this._onPushDeviceList.bind(this),
      "WxDebug.setEntry": this._onSetEntry.bind(this),
      "WxDebug.refreshPage": this._onRefreshPage.bind(this)
  };
}

TheDebugger.DeviceManagerClass.Events = {
  PushDeviceList: Symbol("WxDebug.pushDeviceList"),
  SetEntry: Symbol("WxDebug.setEntry"),
  RefreshPage: Symbol("WxDebug.refreshPage")
}

TheDebugger.DeviceManagerClass.prototype = {

  connect: function(deviceListUrl, replace) {

    if (this._connected && !replace) {
      console.log("Already exists a connection.");
      return;
    }

    if (this._websocket && this._connected) {
      this._websocket.close();
      this._websocket = null;
    }

    // ws://host:port/debugProxy/list
    console.log('DeviceManager starts to connect server.');
    this._websocket = new WebSocket(deviceListUrl);

    // ['open', 'error', 'close', 'message']
    this._websocket.onopen = this._onOpen.bind(this);
    this._websocket.onerror = this._onError.bind(this);
    this._websocket.onclose = this._onClose.bind(this);
    this._websocket.onmessage = this._onMessage.bind(this);
  },

  disconnect: function() {
    if (this._websocket && this._connected) {
      this._websocket.close();
      this._websocket = null;
    }
  },

  _onOpen: function() {
    this._connected = true;
    console.log('Device manager connected.');
  },

  /**
   * e.g.
   * 1. connect ECONNREFUSED when server is died.
   */
  _onError: function(err) {
    this._connected = false;
    this._websocket.close();
    console.error(err);
  },

  _onClose: function() {
    this._connected = false;
    console.log('Device manager disconnected');
  },

  /**
   * event.data.method === 'WxDebug.pushDeviceList'
   * event.data.method === 'WxDebug.setEntry'
   * event.data.method === 'WxDebug.refreshPage'
   */
  _onMessage: function(event, flags) {
    this._messageId++;
    var message = JSON.parse(event.data);

    if (this._messageMap[message.method]) {
      this._messageMap[message.method](message);
    } else {
      console.error('DeviceManager recv unknown message: ' + message.method);
    }
  },

  sendMessage: function(message) {
    if (!(typeof message === 'string')) {
      message = JSON.stringify(message);
    }
    if (this._websocket && this._connected) {
      this._websocket.send(message);
    }
  },

  /**
     [
       {
         remoteDebug: false,
         platform: "android",
         deviceId: "DU2SSE146R014140|com.alibaba.falcon : 8996",
         weexVersion: "0.9.1.5",
         logLevel: "debug",
         name: "com.alibaba.falcon : 8996",
         devtoolVersion: "0.0.8.5",
         model: "H60-L01",
         inspectorSessionId: "iy46qnfu1yeqms957r4",
         debuggerSessionId: "iy46qnfvbv56ld0527k"
       }
     ]
   */
  _onPushDeviceList: function(message) {
    var newList = message.params || [];
    newList.forEach((device) => {
      // Diff device list to save newly connected device from debug state.
      if (device && !this.findDeviceById(device.deviceId) && device.remoteDebug) {
        this.setRemoteDebug(device.deviceId, false);
      }
    });
    this._deviceList = newList;
    this.dispatchEventToListeners(TheDebugger.DeviceManagerClass.Events.PushDeviceList, this._deviceList);
  },

  _onSetEntry: function(message) {
    console.log('_onSetEntry', message);
  },

  _onRefreshPage: function(message) {
    console.log('_onRefreshPage', message);
  },

  /**
   * Set log level: debug, log, info, warn, error
   */
  setLogLevel: function(deviceId, level) {
    if (deviceId) {
      var message = {
        method: 'WxDebug.setLogLevel',
        params: {
          deviceId: deviceId,
          data: level
        }
      };
      this.sendMessage(message);
    }
  },

  /**
   * Set element mode: native, vdom
   */
  setElementMode: function(deviceId, mode) {
    if (deviceId) {
      var message = {
        method: 'WxDebug.setElementMode',
        params: {
          deviceId: deviceId,
          data: mode
        }
      };
      this.sendMessage(message);
    }
  },

  /**
   * Switch remote debug mode: on, off
   */
  setRemoteDebug: function(deviceId, onoff) {
    if (deviceId) {
      var message = {
        method: 'WxDebug.setRemoteDebug',
        params: {
          deviceId: deviceId,
          data: onoff
        }
      }
      this.sendMessage(message);
    }
  },

  /**
   * UI command to attach debugger to targetDevice.
   */
  attach: function(targetDevice) {
    if (targetDevice) {

    }
  },

  /**
   * @param {string} deviceId
   * 'DU2SSE146R014140|com.alibaba.weex : 7938'
   */
  findDeviceById(deviceId) {

    var retDevice = null;
    if (deviceId && this._deviceList) {
      this._deviceList.forEach((device) => {
        if (device.deviceId === deviceId)
          retDevice = device;
      });
    }
    return retDevice;
  },

  __proto__: TheDebugger.Object.prototype
}

module.exports.DeviceManagerClass = TheDebugger.DeviceManagerClass

TheDebugger.deviceManager = new TheDebugger.DeviceManagerClass();