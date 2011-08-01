exports.createBalancerServer = createBalancerServer;
function createBalancerServer(port, balancer) {
  getTieredServer({
    https: function(req, res) {
      balancer.resolveHttps(port, req, res, function(err) {
        if(err) {
          balancer.resolveTls(port, req.connection.pair.cleattext, req.connection.pair.encrypted)
        }
      });
    },
    http: function() {
      balancer.resolveHttp(port, req, res, function(err) {
        if(err) {
          balancer.resolveTcp(port, req.connection.pair.cleattext, req.connection.pair.encrypted)
        }
      });
    },
    tcp: function() {
      balancer.resolveTcp(port, this)
    },
    tls: function(clearText, encrypted) {
      balancer.resolveTls(port, clearText, encrypted, function(err) {
        if(err) {
          balancer.resolveTcp(port, req.connection.pair.cleattext, req.connection.pair.encrypted)
        }
      });
    },
    udp: function() {
      balancer.resolveUdp(port, this);
    }
  }).listen(port);
}
