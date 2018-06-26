![LOGO](https://camo.githubusercontent.com/22a347b6cc07f98ce0ee06be66385a4cb967d4a7/687474703a2f2f6d6f6c6563756c65722e73657276696365732f696d616765732f62616e6e65722e706e67)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/tiaod/moleculer-sc/master/LICENSE)
[![npm](https://img.shields.io/npm/v/moleculer-sc.svg)](https://www.npmjs.com/package/moleculer-sc)
# moleculer-sc
An API Gateway service for Moleculer framework using SocketCluster

**What is SocketCluster?**
[SocketCluster](https://socketcluster.io/) is an open source real-time framework for Node.js. It supports both direct client-server communication and group communication via pub/sub channels. It is designed to easily scale to any number of processes/hosts and is ideal for building chat systems.


# Features
- Call moleculer actions by emiting SocketCluster events.
- Support SocketCluster authorization (sc `socket.authToken` => moleculer `ctx.meta.user`)
- Whitelist.

# Install
```shell
$ npm install moleculer-sc
```
# Usage
SocketCluster is a fast, highly scalable HTTP + WebSockets server environment which lets you build multi-process real-time systems that make use of all CPU cores on a machine/instance.

Before you start, you have to create a SocketCluster project, and write the code in `worker.js`. (See `/examples/simple`)

## Handle socket events
Create your own SocketCluster Gateway service.
```javascript
// SocketCluster worker.js
const SCWorker = require('socketcluster/scworker');
const { ServiceBroker } = require('moleculer')
const SocketClusterService = require('moleculer-sc')
class Worker extends SCWorker {
  run() {
    console.log('   >> Worker PID:', process.pid);
    var environment = this.options.environment;
    let broker = new ServiceBroker({
      logger: console
    })
    broker.createService({
      name:'sc-gw',
      mixins:[SCService(this)], //create SCService with worker.
    })
    broker.start()
  }
}
```
By default, `moleculer-sc` will handle the `call` event which proxy to moleculer's `broker.call`
Examples:
- Call `test.hello` action: `socket.emit('call',{action:'test.hello'}, callback)`
- Call `math.add` action with params: `socket.emit('call',{action:'math.add', params:{a:25, b:13}}, callback)`
- Get health info of node: `socket.emit('call',{ action: '$node.health' }, callback)`
- List all actions: `socket.emit('call', { action: '$node.list'}, callback)`

## Whitelist
If you don’t want to public all actions, you can filter them with whitelist option.
You can use match strings or regexp in list.
``` javascript
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
        /^math\.\w+$/
      ]
    }]
    }
})
```

## Multiple routes
You can create multiple routes with different whitelist, calling options & authorization.
```javascript
broker.createService({
  mixins: [SocketClusterService(worker)],
  settings: {
    routes: [
      {
        event: "adminCall",
        whitelist: [
          "$node.*",
          "users.*",
        ]
      },
      {
        event: "call",
        whitelist: [
          "posts.*",
          "math.*",
        ]
      }
    ]
  }
});
```

## Authorization
You can implement authorization. For this you need to do 2 things.
1. Define the authorization handler in SocketCluster.
2. Rewrite the `getMeta` method of `sc-gw` service. (Optional)

Example authorization:
```javascript
socket.on('login', function (credentials, respond) {
  broker.call('v1.account.login', data).then(res=>{
    socket.setAuthToken(res) //success
    callback(null,res)
  }).catch(err=>{
    const errObj = _.pick(err, ["name", "message", "code", "type", "data"])
    callback(errObj)
  }) //error
})
```
For convenience, we did this for you. You could set a handler with `login` type:
```javascript
broker.createService({
  mixins: [SocketClusterService(worker)],
  settings: {
    routes: [
      {
        event: "login",
        type:'login', //Set route type to login, when calling success, you are logged in!
        whitelist: [
          "login.password",
          "login.google",
          "login.github"
        ]
      }
    ]
  }
});
// Add an handler service
broker.createService({
  name:'login',
  actions: {
    password(ctx) {
      if(ctx.params.user == 'tiaod' && ctx.params.password == 'pass'){
        return {id: 'tiaod'}
      }else{
        throw new Error('UNAUTH')
      }
    }
  }
})
```
Then:
```javascript
socket.emit('login', {action:'login.password', params: {user: 'tiaod', password:'pass'}}, function(err, data){
  console.log('call login.passoword:',data)
  console.log(socket.authToken.id == 'tiaod') //true
})
```

Also you could overwrite the `getMeta` method to add more addition meta info. The default `getMeta` method is:
```javascript
getMeta(socket){
  return {
    user: socket.authToken
  }
}
```
Example to add more additional info:
```javascript
broker.createService({
  name:'sc-gw',
  mixins:[SocketClusterService(worker)],
  methods:{
    getMeta(socket){ //construct the meta object.
      return {
        user: socket.authToken,
        socketId: socket.id
      }
    }
  }
})
```

## Calling options

The route has a callOptions property which is passed to broker.call. So you can set timeout, retryCount or fallbackResponse options for routes.

```javascript
broker.createService({
  mixins: [SocketClusterService(worker)],
  settings: {
    routes: [{
      event:'call',
      whitelist: [
        "posts.*",
        "math.*",
      ],
      callOptions: {
        timeout: 500,
        retryCount: 0,
        fallbackResponse(ctx, err) { ... }
      }
    }]		
  }
});
```
**Note**: If you provie a meta field here, it replace the `getMeta` method's result.
```javascript
broker.createService({
  mixins: [SocketClusterService(worker)],
  settings: {
    routes: [{
      event:'call',
      callOptions: {
        meta: { abc:123 }
      }
    }]		
  },
  methods:{
    getMeta(socket){
      return {
        user: socket.authToken
      } //This will be replaced by callOptions.meta
    }
  }
});
```

## Access control lists
If you want to do a role-based access control, you can do it on SocketCluster way. Here is an example using `node_acl`:
```javascript
let acl = require('acl')
acl = new acl(new acl.memoryBackend())
acl.allow('admin', 'math', 'add') // allow admin to call
acl.addUserRoles('user id here', 'admin')
scServer.addMiddleware(scServer.MIDDLEWARE_EMIT,
  async function (req, next) {
    if(!data || typeof data.action !== 'string') next(new Error('invaild request'))
    let [service, action] = req.data.action.split('.', 2)
    if (!await acl.isAllowed(req.socket.authToken.id, service, action)) {
      next(); // Allow
    } else {
      var err = MyCustomEmitFailedError(req.socket.id + ' is not allowed to call action ' + req.event);
      next(err); // Block
      // next(true); // Passing true to next() blocks quietly (without raising a warning on the server-side)
    }
  }
);

```

## Error parser
You can rewrite global-level error handler:
> In handler, you must call the `respond`. Otherwise, the request is unhandled.

```javascript
broker.createService({
  mixins: [SocketClusterService(worker)],
  settings: {
    routes: [{
      event:'call',
      callOptions: {
        meta: { abc:123 }
      }
    }]		
  },
  methods:{
    onError(err, respond){ //This is the default handler
      const errObj = _.pick(err, ["name", "message", "code", "type", "data"]);
      return respond(errObj)
    }
  }
});
```

## SocketCluster transporter
You can also use SocketCluster as moleculer's transporter!
```javascript
// worker.js
const { ServiceBroker } = require('moleculer')
const SCTransporter = require('moleculer-sc/transporter')
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
broker.start().then(()=>{
  console.log('broker1 started!')
})
```
```javascript
// external-service.js
const { ServiceBroker } = require('moleculer')
const SCTransporter = require('moleculer-sc/transporter')
let broker2 = new ServiceBroker({
  nodeID: "node-2",
  logger: console,
  transporter: new SCTransporter({
    hostname:'localhost',
    port:8000
  })
})
broker2.start()
  .then(() => broker2.call("math.add", { a: 5, b: 3 }))
  .then(res => console.log("5 + 3 =", res))
```
**Warning:** You should add a SocketCluster middleware to apply access control with `MOL.` channel prefix.


You can also pass an socket object or SCExchange instance:

``` javascript
new SCTransporter({
  socket:socket
})
// or
new SCTransporter({
  exchange:exchange
})
```


## Publish to scChannel
Just do:
```javascript
let data = {
  hello: 'world'
}
broker.call('sc-gw.publish',{
  topic: 'your.topic.here',
  data: data
})
```

# Change logs
**0.9.0** - Add `publish` action.

**0.8.1** - Fix `getMeta` error.

**0.8.0** - Add `login` handler type.

**0.7.0** - Add `onError` handler

**0.6.1** - You can pass `socket` or `exchange` object to SCTransporter now.

**0.6.0** - Breaking change:
Don't pass worker in settings anymore, you should pass the worker when initerlized the service.
```javascript
// old:
broker.createService({
  name:'sc-gw', // SocketCluster GateWay
  mixins:[SCService], //This will not work anymore
  settings:{
    worker,
  }
})
```
```javascript
// new:
broker.createService({
  name:'sc-gw',
  mixins:[SCService(worker)], //create SCService with worker.
})
```
This is because the settings is also obtainable on remote nodes, it is transferred during service discovering, which will cause a `TypeError: Converting circular structure to JSON` when serializing it.

**0.5.0** - Add transporter.

**0.4.0** - Add multiple routes support.

**0.3.0** - Doesn't integrate `node_acl` anymore. If you need access control lists, you can do it on socketcluster side.
