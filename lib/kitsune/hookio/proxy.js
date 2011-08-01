function balanceHook(hook, balancer) {
  hook.on('*::proxy', function onProxy(desiredPort, actualPort, actualHost, options) {
    balancer.provision(desiredPort, actualPort, actualHost);
  });
  hook.on('*::unproxy', function onProxy(desiredPort, actualPort, actualHost, options) {
    balancer.release(desiredPort, actualPort, actualHost);
  });
}
exports.balanceHook = balanceHook;
