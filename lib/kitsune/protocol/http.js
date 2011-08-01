var http = require('http');

exports.createServerFallback = createServerFallback;
function createServerFallback(server, fallbacks) {
  fallbacks = fallbacks || {};
  var connectionListeners = server._events.connection;
  var oldConnectionListener = http._connectionListener;
  if(connectionListeners.indexOf) {
    var index = connectionListeners.indexOf(oldConnectionListener)
    if(index !== -1) {
      var connectionListener = exports.connectionHandlerForServer(server);
      connectionListeners.splice(index, 1, connectionListener);
    }
  }
  else if (connectionListeners == oldConnectionListener) {
    var connectionListener = exports.connectionHandlerForServer(server);
    server._events.connection = connectionListener;
  }
}
exports._connectionListener = http._connectionListener;

exports.connectionHandlerForServer = connectionHandlerForServer;
function connectionHandlerForServer(server, oldConnectionListener, fallbacks) {
  return function connectionListener(socket) {
    if(server.listeners('checkContinue').length) {
      server.on('checkContinue', onHttp);
    }
    var buffers = [];
    var length = 0;
    var oldOnData = socket.ondata;
    var oldOnEnd = socket.onend;
    var oldDestroy = socket.destroy;
    var oldDestroySoon = socket.oldDestroySoon;
    var oldEvents = socket._events;
    function onData(data) {
      if(!buffers) return;
      length += data.length;
      buffers.push(data);
    }
    function cleanup() {
      buffers = undefined;
      server.removeListener('request', onHttp);
      server.removeListener('checkContinue', onHttp);
      socket.removeListener('data', onData);
      socket.ondata = oldOnData;
      socket.onend = oldOnEnd;
      socket.destroy = oldDestroy;
      socket.destroySoon = oldDestroySoon;
    }
    function onHttp(req) {
      if(req.connection === socket) {
        if(fallbacks.http) fallbacks.http.apply(socket, arguments);
        cleanup();
      }
    }
    function fallbackBootstrap() {
      var cbuffers = buffers;
      cleanup();
      socket.setTimeout(0);
      socket._events = oldEvents;
      if(fallbacks.tcp) fallbacks.tcp.apply(socket, arguments);
      process.nextTick(function() {
        for(var i = 0; i < cbuffers.length; i++) {
          var buff = cbuffers[i];
          socket.emit('data', buff);
          if(socket.ondata) {
            socket.ondata(buff, 0, buff.length);
          }
        }
      });
    }
    server.on('request', onHttp);
    socket.on('data', onData);
    socket.destroy = fallbackBootstrap;
    socket.destroySoon = fallbackBootstrap;
    oldConnectionListener.call(server, socket);
  };
}
