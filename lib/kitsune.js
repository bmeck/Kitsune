var EventEmitter = require('events').EventEmitter;
var util = require('util');
var http = require('http');
var https = require('https');
var journey = require('journey');
var Balancer = require('./kitsune/balancer');
function toPort(x) { 
  return (x = Number(x)) >= 0 ? x : false; 
}

function Kitsune(options) {
  options = options || {};
  EventEmitter.call(this);
  var self = this;
  
  this.insecure = options.insecure || false;
  this.router = new journey.Router();
  this.balancer = new Balancer();
  this.servers = [];
  
  var oldEmit = this.balancer.emit;
  this.balancer.emit = function emit() {
    self.emit.apply(self, arguments);
    return oldEmit.apply(this, arguments);
  }
  
  this.setupRouter();
}
util.inherits(Kitsune, EventEmitter);
module.exports = Kitsune;

Kitsune.prototype.setupRouter = function setupRouter() {
  var self = this;
  this.router.map(function () {
    this.root.bind(function (req, res) { res.send(404) });
    this.get('mappings').bind(function (req, res) {
      self.balancer.mappings(function (err, mappings) {
        if(err) res.send(err.code || 500, {}, err);
        else res.send(200, {}, mappings);
      });
    });
    this.post('/proxy').bind(function (req, res, data) {
      console.dir(arguments)
      self.balancer.provision(data.desiredPort, data.actualPort, data.actualHost, null, function (err) {
        if(err) res.send(err.code || 500, err);
        else res.send(201);
      });
    });
    this.del('/proxy').bind(function (req, res, data) {
      self.balancer.release(data.desiredPort, data.actualPort, data.actualHost, null, function (err) {
        if(err) res.send(err.code || 500, err);
        else res.send(200);
      });
    });
  });
}

Kitsune.prototype.listen = function listen() {
  var self = this;
  function onRequest(request, response) {
    var body = "";

    request.addListener('data', function (chunk) { body += chunk });
    request.addListener('end', function () {
      self.router.handle(request, body, function (result) {
        response.writeHead(result.status, result.headers);
        response.end(result.body);
      });
    });
  }
  var server;
  if(typeof arguments[0] === 'object' && arguments[0] instanceof http.Server) {
    server = arguments[0];
    if(!this.insecure && server instanceof htts.Server) {
      throw new Error('Cannot bind to an insecure server when Kitsune is not set to insecure.');
    }
    server.on('request', onRequest);
  }
  else if(toPort(arguments[0])) {
    if(this.insecure) {
      server = http.createServer(onRequest);
    }
    else {
      server = https.createServer(onRequest);
    }
    server.listen.apply(server, arguments);
  }
  else {
    throw new Error('Do not know how listen to these arguments.');
  }
  this.emit('server::listen', server);
  this.servers.push(server);
  
  server.on('close', function() {
    this.emit('server::close', server);
    self.servers.splice(self.servers.indexOf(server), 1);
  });
}
