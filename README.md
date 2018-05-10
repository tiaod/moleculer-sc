![LOGO](https://camo.githubusercontent.com/22a347b6cc07f98ce0ee06be66385a4cb967d4a7/687474703a2f2f6d6f6c6563756c65722e73657276696365732f696d616765732f62616e6e65722e706e67)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/tiaod/moleculer-sc/master/LICENSE)
[![npm](https://img.shields.io/npm/v/moleculer-sc.svg)](https://www.npmjs.com/package/moleculer-sc)
# moleculer-sc
An API Gateway service for Moleculer framework using SocketCluster

[SocketCluster](https://socketcluster.io/) is an open source real-time framework for Node.js. It supports both direct client-server communication and group communication via pub/sub channels. It is designed to easily scale to any number of processes/hosts and is ideal for building chat systems.


# Features
- Call moleculer actions by emit SocketCluster events.
- Support SocketCluster authorization (`socket.authToken` => moleculer `ctx.meta.user`)
- Whitelist

# Install
```
$ npm install --save moleculer-sc
```
# Usage
SocketCluster is a fast, highly scalable HTTP + WebSockets server environment which lets you build multi-process real-time systems that make use of all CPU cores on a machine/instance.

Before you start, you have to create a SocketCluster project, and write the code in `worker.js`.

## Handle socket events
Create your own SocketCluster Gateway service.
```javascript
// SocketCluster worker.js
const { ServiceBroker } = require('moleculer')
const SocketClusterService = require('moleculer-sc')
module.exports.run = function (worker) {
  let broker = new ServiceBroker({
    logger: console
  })
  broker.createService({
    name:'sc-gw',
    mixins:[SocketClusterService],
    settings:{
      worker, // Pass the sc worker to settings.
    }
  })
  broker.start()
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
  mixins:[SocketClusterService],
  settings: {
    worker,
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
## Calling options

The route has a callOptions property which is passed to broker.call. So you can set timeout, retryCount or fallbackResponse options for routes.

**Note**: If you provie a meta field here, it replace the `getMeta` method's result.
```javascript
broker.createService({
    mixins: [SocketClusterService],
    settings: {
        routes: [{
            callOptions: {
                timeout: 500,
                retryCount: 0,
                fallbackResponse(ctx, err) { ... }
            }
        }]		
    }
});
```
## Multiple routes
You can create multiple routes with different prefix, whitelist, alias, calling options & authorization.
```javascript
broker.createService({
  mixins: [SocketClusterService],
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
// Server code
// This is a slightly simplified version of what it might look
// like if you were using MySQL as a database.

socket.on('login', function (credentials, respond) {
  var passwordHash = sha256(credentials.password);

  var userQuery = 'SELECT * FROM Users WHERE username = ?';
  mySQLClient.query(userQuery, [credentials.username], function (err, rows) {
    var userRow = rows[0];
    var isValidLogin = userRow && userRow.password === passwordHash;
    if (isValidLogin) {
      respond();
      // This will give the client a token so that they won't
      // have to login again if they lose their connection
      // or revisit the app at a later time.
      socket.setAuthToken({username: credentials.username, channels: userRow.channels});
    } else {
      // Passing string as first argument indicates error
      respond('Login failed');
    }
  })
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
  mixins:[SocketClusterService],
  settings:{
    worker, // Pass the sc worker to settings.
  },
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

## Publish to scChannel
Just do it on SocketCluster way!




# Change logs
**0.5.0** - Add transporter.

**0.4.0** - Add multiple routes support.

**0.3.0** - Doesn't integrate `node_acl` anymore. If you need access control lists, you can do it on socketcluster side.
