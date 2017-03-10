
DeviceModel = function() {

  this._deviceManager = new TheDebugger.DeviceManagerClass();
  this._deviceManager.addEventListener(TheDebugger.DeviceManagerClass.Events.PushDeviceList, this._onPushDeviceList, this);
}

DeviceModel.prototype = {

  dispose: function() {
    TheDebugger.deviceManager.removeEventListener(TheDebugger.DeviceManagerClass.Events.PushDeviceList, this._onPushDeviceList, this);
    this._deviceManager.disconnect();
  },

  connect: function(deviceListUrl) {
    this._deviceManager.connect(deviceListUrl, true);
  },

  _onPushDeviceList: function(events) {
    console.log(events.data);
    atom.commands.dispatch(atom.views.getView(atom.workspace), "console.targets", events.data);
  },

  findDeviceById: function(deviceId) {
    return this._deviceManager.findDeviceById(deviceId);
  },

  stopDebug: function(deviceId) {
    this._deviceManager.setRemoteDebug(deviceId, false);
  }

}

module.exports = DeviceModel
