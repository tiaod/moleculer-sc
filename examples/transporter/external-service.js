const { ServiceBroker } = require('moleculer')
const SCTransporter = require('../../transporter')
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
