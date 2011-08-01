var EventEmitter = require('events').EventEmitter;
var net = require('net');
var dgram = require('dgram');
var util = require('util');
var BalancerTable = require('./balancerTable').BalancerTable;
function toPort(x) { 
  return (x = Number(x)) >= 0 ? x : false; 
}

//
// TODO : Select more protocols [TLS, HTTP, HTTPS]
//      : Filter protocols per port / server
//      : Options like manual heartbeats
//
function Balancer(options) {
  EventEmitter.call(this);
  options = options || {};
  this.defaultHost = options.defaultHost || '127.0.0.1';
  this.servers = {
    // port : TieredServer
  };
  this.httpProxy = new httpProxy.HttpProxy(options);
}
util.inherits(Balancer, EventEmitter);
module.exports = Balancer;


Balancer.prototype.provision = function provision (desiredPort, actualPort, actualHost, options, callback) {
  desiredPort = toPort(desiredPort);
  actualPort = toPort(actualPort);
  if(!desiredPort || !actualPort) {
    var err = new Error('Data invalid');
    err.code = 400;
    callback(err);
    return;
  }
  var self = this;
  var descriptor = {
    port: actualPort,
    host: actualHost || this.defaultHost,
    options: options
  };
  
  if(!self.servers[desiredPort]) {
    var tieredServer = getTieredServer({
      http: function(req, res) {
        var balancers = self.servers[desiredPort]
        if(balancers) {
          balancers.http.balance(req.connection.remoteAddress, req.headers.host, function(err, descriptor) {
            if(err) {
              res.writeHead(404);
              return res.end();
            }
            return self.httpProxy.proxyRequest(req, res, descriptor.host, descriptor.port);
          });
        }
      },
      https: function(req, res) {
        var balancers = self.servers[desiredPort]
        if(balancers) {
          balancers.https.balance(req.connection.remoteAddress, req.headers.host, function(err, descriptor) {
            if(err) {
              res.writeHead(404);
              return res.end();
            }
            return self.httpProxy.proxyRequest(req, res, descriptor.host, descriptor.port);
          });
        }
      },
      tcp: function(err) {this.end()},
      tls: function(clearText, encrypted) {clearText.end()}
    })
    
    self.servers[desiredPort] = {
      http: new BalancerTable(),
      https: new BalancerTable(),
      //tcp: new BalancerTable(),
      //tls: new BalancerTable(),
      server: server
    }
    
    try {
      server.listen(desiredPort);
    }
    catch(e) {
      e.code = 500;
      if(callback) callback(e)
      return;
    }
  }
  
  var balancers = self.servers[desiredPort];
  var protocols = this.protocolsFromOptions(options);
  for(var i = 0; i < protocols.length; i++) {
    if(options.ip) {
      balancers[protocols[i]].addIPForward(options.ip, options.domain, descriptor);
    }
    else if(options.domain) {
      balancers[protocols[i]].addDomainForward(options.domain, descriptor);
    }
    else {
      balancers[protocols[i]].addForward(descriptor);
    }
  }
  
  
  self.emit('balancer::proxy::provision', desiredPort, descriptor);
  if(callback) callback(false);
}

Balancer.prototype.protocolsFromOptions = function protocolsFromOptions(options) {
  var protocols = [];
  if(options.domain) {
    protocols.filter(function(protocol){
      return ['tcp', 'tls'].indexOf(protocol) === -1;
    });
  }
  if(options.secure) {
    protocols.filter(function(protocol){
      return ['tcp', 'http'].indexOf(protocol) === -1;
    });
  }
  return protocols;
}


Balancer.prototype.release = function release (desiredPort, actualPort, actualHost, options, callback) {
  var self = this;
  var descriptor = {
    port: actualPort,
    host: actualHost || this.defaultHost,
    options: options
  };
  var balancers = self.servers[desiredPort];
  var protocols = this.protocolsFromOptions(options);
  for(var i = 0; i < protocols.length; i++) {
    if(options.ip) {
      balancers[protocols[i]].dropIPForward(options.ip, options.domain, descriptor);
    }
    else if(options.domain) {
      balancers[protocols[i]].dropDomainForward(options.domain, descriptor);
    }
    else {
      balancers[protocols[i]].dropForward(descriptor);
    }
  }
  self.emit('balancer::proxy::release', desiredPort, descriptor);
  if(callback) callback(false);
}


Balancer.prototype.mappings = function mappings(callback) {
  callback(false, this.ports);
}
