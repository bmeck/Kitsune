exports.createServerFallback = createServerFallback;
var tls = require('../protocol/tls');
var http = require('../protocol/http');
var node_https = require('https');

function getTieredServer(handlers, options) {
  options = options || {};
  if(typeof options == 'function') options = {};
  var server = node_https.createServer(options);
  createServerFallback(server, handlers, options);
  return server;
}
module.exports = getTieredServer;

function createServerFallback(server, fallbacks, options) {
  var connectionListeners = server._events.connection;
  fallbacks = fallbacks || {};
  tls.createServerFallback(server, {
    tls: function(clearText, encrypted) {
      if(options.timeout) this.setTimeout(options.timeout);
      var args = arguments;
      http.connectionHandlerForServer(server, http._connectionListener, {
        http: fallbacks.https,
        tcp: function() {
          if(fallbacks.tls) fallbacks.tls.apply(this, args)
        }
      }).call(server, clearText);
    },
    tcp: function() {
      if(options.timeout) this.setTimeout(options.timeout);
      http.connectionHandlerForServer(server, http._connectionListener, {
        http: fallbacks.http,
        tcp: fallbacks.tcp
      }).call(server, this);
    }
  })
}
