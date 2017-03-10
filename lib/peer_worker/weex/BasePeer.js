
function BasePeer() {
  this.peer = null;
}

BasePeer.prototype = {

  start: function() {
    // Stub
  },

  terminate: function() {
    // Stub
  },

  bindPeer: function(peer) {
    this.peer = peer;
  },

  /**
   * Send message to peer.
   */
  send2Peer: function(message) {
    if (!this.peer) {
      console.error('Peer missed for: ', message);
      return;
    }
    this.peer.onPeerMessage(message);
  },

  /**
   * Message from peer.
   */
  onPeerMessage: function(message) {
    // Stub to be implement
    console.log('Sub onmessage: ', message);
  }
}

module.exports = BasePeer;
