import test from 'ava'
import EventEmitter from 'events'
import pEvent from 'p-event'
import keys from 'lodash/keys'
import isEqual from 'lodash/isEqual'
const { ServiceBroker } = require("moleculer");
const SocketClusterService = require('../src')

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
});

test('methods: checkWhitelist',async t=>{
  const svc = t.context.broker.createService({
    name:'sc-gw', // SocketCluster GateWay
    mixins:[SocketClusterService],
    settings:{
      worker:{},
      whitelist:[
        'math.add',
        'user.*',
        /^test\.json/
      ]
    }
  })
  t.true(svc.checkWhitelist('math.add')) // in whitelist
  t.true(svc.checkWhitelist('user.anything')) //wildcard
  t.true(svc.checkWhitelist('test.json')) // regexp
  t.false(svc.checkWhitelist('$node.list')) // not exist
  t.false(svc.checkWhitelist('does.not.exist'))
})

test('should attach services to socket', async t=>{
  const {broker} = t.context
  const worker = new EventEmitter()
  worker.scServer = new EventEmitter()
  const svc = broker.createService({
    name:'sc-gw', // SocketCluster GateWay
    mixins:[SocketClusterService],
    settings:{
      worker,
    }
  })
  broker.createService({
    name: 'math',
    actions:{
      add(){
        return 12
      }
    }
  })
  broker.start()
  await sleep(1000)
  return new Promise(function(resolve, reject) {
    const socket = new EventEmitter()
    socket.on('newListener', (eventName, handler)=>{
      t.true(eventName == 'math.add')
      resolve()
    })
    worker.scServer.emit('connection', socket)
  });
})

test('should only attach services in whitelist', async t=>{
  const {broker} = t.context
  const worker = new EventEmitter()
  worker.scServer = new EventEmitter()
  const svc = broker.createService({
    name:'sc-gw', // SocketCluster GateWay
    mixins:[SocketClusterService],
    settings:{
      worker,
      whitelist:[
        'math.add',
        'user.*',
        /^test\.json/
      ]
    }
  })
  broker.createService({
    name: 'math',
    actions:{
      add(){
        return 12
      },
      pi(){ //not in whitelist
        return 3.14
      }
    }
  })
  broker.createService({
    name: 'user',
    actions:{
      foo(){
        return 'foo'
      },
      bar(){
        return 'bar'
      }
    }
  })
  broker.start()
  await sleep(1000)
  t.plan(3)
  return new Promise(function(resolve, reject) {
    const socket = new EventEmitter()
    let i = 0
    socket.on('newListener', (eventName, handler)=>{
      t.true(['math.add','user.foo','user.bar'].indexOf(eventName)!== -1)
      i++
      if(i == 3){
        resolve()
      }
    })
    worker.scServer.emit('connection', socket)
  });
})


test('add and remove services', async t => {
  const {broker} = t.context
  const worker = new EventEmitter()
  worker.scServer = new EventEmitter()
  const svc = broker.createService({
    name:'sc-gw', // SocketCluster GateWay
    mixins:[SocketClusterService],
    settings:{
      worker
    }
  })
  broker.start()
  broker.createService({
    name: 'math',
    actions:{
      add(){
        return 12
      },
      pi(){ //not in whitelist
        return 3.14
      }
    }
  })
  await sleep(100)
  t.true(isEqual(
    new Set(['math.add', 'math.pi']),
    new Set(keys(svc.handlers))
  ), 'math services should add to handlers')
  const math2Svc = broker.createService({
    name: 'math2',
    actions:{
      add(){
        return 12
      },
      pi(){ //not in whitelist
        return 3.14
      }
    }
  })
  await sleep(100)
  t.true(isEqual(
    new Set(['math.add', 'math.pi','math2.add','math2.pi']),
    new Set(keys(svc.handlers))
  ), 'math2 actions should add to handlers')
  broker.destroyService(math2Svc)
  await sleep(1000)
  t.true(isEqual(
    new Set(['math.add', 'math.pi']),
    new Set(keys(svc.handlers))
  ), 'math services should add to handlers')
})
