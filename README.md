![](https://camo.githubusercontent.com/22a347b6cc07f98ce0ee06be66385a4cb967d4a7/687474703a2f2f6d6f6c6563756c65722e73657276696365732f696d616765732f62616e6e65722e706e67)
# moleculer-sc
A API Gateway service for Moleculer framework using SocketCluster

# Features
- Proxy SocketCluster events to moleculer.
- Support SocketCluster authorization (`socket.authToken` => moleculer `ctx.meta.user`)
- Access control lists (Using [node_acl](https://github.com/OptimalBits/node_acl))

# Install
```
$ npm install --save moleculer-sc
```
# Usage
## Handle socket events
Create your own SocketCluster Gateway service.
```javascript
// SocketCluster worker.js
const SocketClusterService = require('moleculer-sc')
module.exports.run = function (worker) {
  broker.createService({
    name:'sc-gw', // SocketCluster GateWay
    mixins:[SocketClusterService],
    settings:{
      worker, // Just pass the worker to settings.
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
Also you can overwrite the `getMeta` method to add more addition meta info. The default `getMeta` method is:
```javascript
getMeta(socket){
  return {
    user: socket.authToken
  }
}
```


## Access control lists
You can also pass a `node_acl` instance to settings:
``` javascript
let acl = require('acl')
acl = new acl(new acl.memoryBackend())
acl.allow('admin', 'math', 'add') // allow admin to call math.add
acl.addUserRoles('user id here', 'admin')
module.exports.run = function (worker) {
  broker.createService({
    name:'sc-gw', // SocketCluster GateWay
    mixins:[SocketClusterService],
    settings:{
      acl, //Optional
      worker,
    }
  })
  broker.start()
}
```
By default, `moleculer-sc` will get the userId from `socket.authToken.id` for `node_acl`. The default `getUserId` method is:
```javascript
getUserId(socket){
  if(socket.authToken && socket.authToken.id){
    return socket.authToken.id
  }
}
```
You can overwrite the `getUserId` method to get userId from other field:
```javascript
broker.createService({
  name:'sc-gw', // SocketCluster GateWay
  mixins:[SocketClusterService],
  settings:{
    acl, //Optional
    worker,
  },
  methods:{
    getUserId(socket){ //scSocket
      return socket.authToken.username
    }
  }
})
```

## Publish to scChannel
todo
