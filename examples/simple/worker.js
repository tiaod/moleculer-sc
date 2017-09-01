var fs = require('fs');
var express = require('express');
var serveStatic = require('serve-static');
var path = require('path');
var morgan = require('morgan');
var healthChecker = require('sc-framework-health-check');
const { ServiceBroker } = require("moleculer");
const SocketClusterService = require('../../lib')


module.exports.run = function (worker) {
  console.log('   >> Worker PID:', process.pid);
  let broker = new ServiceBroker({
    logger: console
  });
  broker.createService({
    name:'sc-gw', // SocketCluster GateWay
    mixins:[SocketClusterService],
    settings:{
      worker,
    }
  })
  broker.createService({
    name:'math',
    actions: {
      add(ctx) {
          return Number(ctx.params.a) + Number(ctx.params.b);
      }
    }
  })
  broker.start()
  var environment = worker.options.environment;

  var app = express();

  var httpServer = worker.httpServer;
  var scServer = worker.scServer;

  if (environment == 'dev') {
    // Log every HTTP request. See https://github.com/expressjs/morgan for other
    // available formats.
    app.use(morgan('dev'));
  }
  app.use(serveStatic(path.resolve(__dirname, 'public')));

  // Add GET /health-check express route
  healthChecker.attach(worker, app);

  httpServer.on('request', app);
};
