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
# Examples
Create your own Api Gateway service.
```javascript
// SocketCluster worker.js
const SocketClusterService = require('moleculer-sc')
module.exports.run = function (worker) {
  broker.createService({
    name:'sc-gw', // SocketCluster GateWay
    mixins:[SocketClusterService],
    settings:{
      worker,
    }
  })
  broker.start()
}
```

You can also pass a `node_acl` instance to settings:
``` javascript
let acl = require('acl')
acl = new acl(new acl.memoryBackend())
acl.allow('admin', 'math', 'add') // allow admin to call math.add
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
