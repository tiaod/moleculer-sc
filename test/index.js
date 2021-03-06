import test from 'ava'
import EventEmitter from 'events'
import pEvent from 'p-event'
import keys from 'lodash/keys'
import isEqual from 'lodash/isEqual'
const { ServiceBroker } = require("moleculer");
const SocketClusterService = require('../src')
const { ServiceNotFoundError } = require("moleculer").Errors;
const { BadRequestError } = require('../src/errors')
function sleep(s){
  return new Promise(function(resolve, reject) {
    setTimeout(resolve, s)
  });
}

test.beforeEach(t => {
  const broker = new ServiceBroker({
    logger: console
  })
  t.context.broker = broker
  const worker = new EventEmitter()
  worker.scServer = new EventEmitter()
  t.context.worker = worker
});

test('methods: checkWhitelist',async t=>{
  const {broker, worker} = t.context
  const svc = broker.createService({
    name:'sc-gw', // SocketCluster GateWay
    mixins:[SocketClusterService(worker)],
  })
  const whitelist = [
    'math.add',
    'user.*',
    /^test\.json/
  ]
  t.true(svc.checkWhitelist('math.add', whitelist)) // in whitelist
  t.true(svc.checkWhitelist('user.anything', whitelist)) //wildcard
  t.true(svc.checkWhitelist('test.json', whitelist)) // regexp
  t.false(svc.checkWhitelist('$node.list', whitelist)) // not exist
  t.false(svc.checkWhitelist('does.not.exist', whitelist))
})

test('should attach handler to socket', async t=>{
  const {broker} = t.context
  const worker = new EventEmitter()
  worker.scServer = new EventEmitter()
  const svc = broker.createService({
    name:'sc-gw', // SocketCluster GateWay
    mixins:[SocketClusterService(worker)],
    settings:{
      routes:[{event:'foo'}],
    }
  })
  broker.start()
  await sleep(100)
  const socket = new EventEmitter()
  socket.on('newListener', (eventName, handler)=>{
    t.true(eventName == 'foo')
    t.pass()
  })
  worker.scServer.emit('connection', socket)
  return sleep(1000)
})

test('should only allow methods in whitelist', async t=>{
  const {broker, worker} = t.context
  broker.createService({
    name:'sc-gw', // SocketCluster GateWay
    mixins:[SocketClusterService(worker)],
    settings: {
      routes: [{
        event: "call",
        whitelist: [
          // Access to any actions in 'posts' service
          "posts.*",
          // Access to call only the `users.list` action
          "users.list",
          // Access to any actions in 'math' service
          "math.add"
        ]
      },{
        event: 'login',
        type: 'login',
        whitelist: [
          "login.password",
        ]
      }]
    }
  })
  broker.createService({
    name:'math',
    actions:{
      add(ctx){
        return 42
      },
      notAllowed(ctx){
        return 43
      }
    }
  })
  broker.createService({
    name: 'login',
    actions: {
      password(ctx){
        if(ctx.params.user === 'tiaod' && ctx.params.password === 'pass'){
           return {id:'tiaod'}
        }else{
          throw new Error('UNAUTH')
        }
      },
      notAllowed(ctx){
        return {id: 'tiaod'}
      }
    }
  })
  broker.start()
  await sleep(100)
  const socket = new EventEmitter()
  socket.setAuthToken = function(authToken){ //mock
    socket.authToken = authToken
  }
  worker.scServer.emit('connection', socket)
  t.plan(3)
  socket.emit('call', {action:'math.add'},function(err, respond){
    if(!err) t.pass()
  })
  socket.emit('call', {action:'math.notAllowed'}, function(err, respond){
    t.true(err.name === 'ServiceNotFoundError')
  })
  socket.emit('login', {action: 'login.password', params: {user: 'tiaod', password: 'pass'}}, function(err, respond){
    if(!err){
      t.true(socket.authToken.id == 'tiaod')
    }
  })
  return sleep(1000)
})


test('emit invaild data should return BadRequestError', async t=>{
  const {broker, worker} = t.context
  broker.start()
  const svc = broker.createService({
    name:'sc-gw', // SocketCluster GateWay
    mixins:[SocketClusterService(worker)],
    settings:{
      routes:[{event:'call'}]
    }
  })
  // await sleep(100)
  const socket = new EventEmitter()
  worker.scServer.emit('connection', socket)
  t.plan(3)
  socket.emit('call', undefined ,function(err, res){
    t.true(err.name === 'BadRequestError')
  })
  socket.emit('call', { action: undefined }, function(err, res){
    t.true(err.name === 'BadRequestError')
  })
  socket.emit('call', { action: {obj:true}}, function(err, res){
    t.true(err.name === 'BadRequestError')
  })
  return sleep(1000)
})

test('getMeta should pass socket as param', async t=>{
  const socket = new EventEmitter()
  socket.authToken = 'tiaod'
  const {broker, worker} = t.context
  const svc = broker.createService({
    name:'sc-gw', // SocketCluster GateWay
    mixins:[SocketClusterService(worker)],
    settings:{
      routes:[{event:'call'}]
    }
  })
  t.plan(2)
  broker.createService({
    name: 'getMetaTest',
    actions: {
      get(ctx){
        t.true(ctx.meta.user === socket.authToken)
        return {ok: true}
      }
    }
  })
  broker.start()
  worker.scServer.emit('connection', socket)
  socket.emit('call', { action: 'getMetaTest.get' }, function(err, res){
    t.true(res.ok)
  })
  return sleep(1000)
})
