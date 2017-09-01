![LOGO](https://camo.githubusercontent.com/22a347b6cc07f98ce0ee06be66385a4cb967d4a7/687474703a2f2f6d6f6c6563756c65722e73657276696365732f696d616765732f62616e6e65722e706e67)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/tiaod/moleculer-sc/master/LICENSE)
[![npm](https://img.shields.io/npm/v/npm.svg)](https://www.npmjs.com/package/moleculer-sc)
# moleculer-sc
A API Gateway service for Moleculer framework using SocketCluster

# Features
- Proxy SocketCluster events to moleculer.
- Support SocketCluster authorization (`socket.authToken` => moleculer `ctx.meta.user`)
- whitelist

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
Example events:
- Call `test.hello` action: `socket.emit('test.hello',null, callback)`
- Call `math.add` action with params: `socket.emit('test.hello',{a:25, b:13}, callback)`
- Get health info of node: `socket.emit('$node.health',null, callback)`
- List all actions: `socket.emit('$node.list', null, callback)`

## Authorization
You can implement authorization. For this you have to do 1 things.
1. Define the authorization handler in SocketCluster.

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
```

## Whitelist
If you don’t want to public all actions, you can filter them with whitelist option.
You can use match strings or regexp in list.
You can also pass a `node_acl` instance to settings:
``` javascript
broker.createService({
  name:'sc-gw', // SocketCluster GateWay
  mixins:[SocketClusterService],
  settings:{
    whitelist: [
      // Access to any actions in 'posts' service
      "posts.*",
      // Access to call only the `users.list` action
      "users.list",
      // Access to any actions in 'math' service
      /^math\.\w+$/
    ]
    worker,
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
    let [service, action] = req.event.split('.', 2)
    if (!await this.settings.acl.isAllowed(req.socket.authToken.id, service, action)) {
      next(); // Allow
    } else {
      var err = MyCustomEmitFailedError(req.socket.id + ' is not allowed to emit event ' + req.event);
      next(err); // Block
      // next(true); // Passing true to next() blocks quietly (without raising a warning on the server-side)
    }
  }
);

```

## Publish to scChannel
todo
