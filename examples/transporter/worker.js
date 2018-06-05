var SCWorker = require('socketcluster/scworker');
var express = require('express');
var serveStatic = require('serve-static');
var path = require('path');
var morgan = require('morgan');
var healthChecker = require('sc-framework-health-check');

const { ServiceBroker } = require('moleculer')
const SCService = require('../../lib/index')
const SCTransporter = require('../../transporter')
class Worker extends SCWorker {
  run() {
    console.log('   >> Worker PID:', process.pid);
    let broker = new ServiceBroker({
      nodeID: "node-1",
      logger: console,
      transporter: new SCTransporter({
        exchange:this.exchange
      })
    })
    broker.createService({
      name:'math',
      actions: {
        add(ctx) {
          return Number(ctx.params.a) + Number(ctx.params.b);
        }
      }
    })
    broker.createService({
      name:'sc-gw',
      mixins: [SCService(this)]
    })
    broker.start().then(()=>{
      console.log('broker1 started!')
    })
    var environment = this.options.environment;
    var app = express();

    var httpServer = this.httpServer;
    var scServer = this.scServer;

    if (environment === 'dev') {
      // Log every HTTP request. See https://github.com/expressjs/morgan for other
      // available formats.
      app.use(morgan('dev'));
    }
    app.use(serveStatic(path.resolve(__dirname, 'public')));

    // Add GET /health-check express route
    healthChecker.attach(this, app);

    httpServer.on('request', app);

    var count = 0;

    /*
      In here we handle our incoming realtime connections and listen for events.
    */
    scServer.on('connection', function (socket) {

      // Some sample logic to show how to handle client events,
      // replace this with your own logic

      socket.on('sampleClientEvent', function (data) {
        count++;
        console.log('Handled sampleClientEvent', data);
        scServer.exchange.publish('sample', count);
      });

      // var interval = setInterval(function () {
      //   socket.emit('random', {
      //     number: Math.floor(Math.random() * 5)
      //   });
      // }, 1000);

      // socket.on('disconnect', function () {
      //   clearInterval(interval);
      // });
    });
  }
}

new Worker();
