const Router = require('express/lib/router');
const Route = require('express/lib/router/route');

let patched = false;

function wrapHandler(handler) {
  if (typeof handler !== 'function') {
    return handler;
  }

  if (handler.length === 4) {
    return handler;
  }

  return function wrappedHandler(req, res, next) {
    try {
      const result = handler(req, res, next);
      if (result && typeof result.then === 'function') {
        result.catch(next);
      }
    } catch (error) {
      next(error);
    }
  };
}

function wrapArgs(args) {
  return args.map((arg) => {
    if (Array.isArray(arg)) {
      return arg.map(wrapHandler);
    }

    return wrapHandler(arg);
  });
}

function patchMethod(target, methodName) {
  const original = target[methodName];
  if (typeof original !== 'function') {
    return;
  }

  target[methodName] = function patchedMethod(...args) {
    return original.apply(this, wrapArgs(args));
  };
}

function installExpressAsyncHandling() {
  if (patched) {
    return;
  }

  patched = true;

  [
    'use',
    'all',
    'get',
    'post',
    'put',
    'patch',
    'delete',
    'options',
    'head',
  ].forEach((methodName) => {
    patchMethod(Router.prototype, methodName);
    patchMethod(Route.prototype, methodName);
  });
}

module.exports = {
  installExpressAsyncHandling,
};
