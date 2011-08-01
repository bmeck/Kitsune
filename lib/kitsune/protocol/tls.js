exports.createServerFallback = createServerFallback;
function createServerFallback(server, fallbacks) {
  fallbacks = fallbacks || {};
  var connectionListeners = server._events.connection;
  var oldConnectionListener;
  if(connectionListeners.indexOf) {
    if(index !== -1) {
      var connectionListener = exports.connectionHandlerForServer(server, oldConnectionListener, fallbacks);
      oldConnectionListener = connectionListeners.splice(0, 1, connectionListener)[0];
    }
  }
  else {
    oldConnectionListener = server._events.connection;
    var connectionListener = exports.connectionHandlerForServer(server, oldConnectionListener, fallbacks);
    server._events.connection = connectionListener;
  }
}

exports.connectionHandlerForServer = connectionHandlerForServer;
function connectionHandlerForServer(server, oldConnectionListener, fallbacks) {
  return function connectionListener(socket) {
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
      server.removeListener('secureConnection', onSecure);
      socket.removeListener('data', onData);
      socket.ondata = oldOnData;
      socket.onend = oldOnEnd;
      socket.destroy = oldDestroy;
      socket.destroySoon = oldDestroySoon;
    }
    function onSecure(clearText) {
      if(clearText.socket === socket) {
        if(fallbacks.tls) fallbacks.tls.apply(socket, arguments);
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
    server.on('secureConnection', onSecure);
    socket.on('data', onData);
    socket.destroy = fallbackBootstrap;
    socket.destroySoon = fallbackBootstrap;
    oldConnectionListener.call(server, socket);
  };
}
