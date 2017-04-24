
function Util() {

}

Util.prototype = {

  /** Return timestamp in millisecond */
  currentTimeMillis: function() {
    return new Date().getTime();
  }
}

module.exports = new Util();
