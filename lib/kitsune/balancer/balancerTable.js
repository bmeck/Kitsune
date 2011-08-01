function BalancerTable() {
  //this.ips = BalancerTable
  //this.domains = BalancerTable
  this.other = [
    //{port:,host:}
  ];
}
exports.BalancerTable = BalancerTable;

BalancerTable.prototype.balance = function balance(ip, domain, callback) {
  var balancer = this;
  if(ip) {
    balancer = this.ips[ip];
    if(!balancer) {
      return callback(true);
    }
    else {
      return balancer.balance(ip, domain, callback)
    }
  }
  if(domain) {
    balancer = this.domains[domain];
    if(!balancer) {
      return callback(true);
    }
    else {
      return balancer.balance(ip, domain, callback)
    }
  }
  if(!balancer.other.length) {
    return callback(true);
  }
  var descriptor = balancer.other.shift();
  balancer.other.push(descriptor);
  return callback(false, descriptor);
}
BalancerTable.prototype.addForward = function addForward(descriptor) {
  this.other.push(descriptor);
}
Balancer.prototype.dropForward = function dropForward(descriptor) {
  var index = 0;
  for(;index < this.other.length; index++) {
    var forward = this.other[index];
    if(descriptor.host == forward.host
    && descriptor.port == forward.port) {
      break;
    }
  }
  if(index === this.other.length) {
    return;
  }
  this.other.splice(index, 1);
}
BalancerTable.prototype.addDomainForward = function addDomainForward(domain, descriptor) {
  if(!this.domains) this.domains = {};
  if(!this.domains[domain]) this.domains[domain] = new BalancerTable();
  this.domains[domain].addForward(descriptor);
}
BalancerTable.prototype.dropDomainForward = function dropDomainForward(domain, descriptor) {
  if(!this.domains) return;
  if(this.domains[domain]) this.domains[domain].dropForward(descriptor);
}
BalancerTable.prototype.addIPForward = function addIPForward(ip, domain, descriptor) {
  if(!this.ips) this.ips = {};
  if(!this.ips[ip]) this.ips[ip] = new BalancerTable();
  if(descriptor) {
    this.ips[ip].addDomainForward(domain, descriptor);
  }
  else {
    this.ips[ip].addForward(descriptor);
  }
}
BalancerTable.prototype.dropIPForward = function dropIPForward(ip, domain, descriptor) {
  if(!this.ips) return;
  if(this.ips[ip]) {
    if(domain) {
      this.ips[ip].dropDomainForward(descriptor);
    }
    else {
      this.ips[ips].dropForward(descriptor);
    }
  }
}
