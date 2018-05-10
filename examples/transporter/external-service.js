const { ServiceBroker } = require('moleculer')
const SCTransporter = require('../../transporter')
const socketCluster = require('socketcluster-client')

const socket = socketCluster.create({
  hostname:'localhost',
  port:8000
})
let broker2 = new ServiceBroker({
  nodeID: "node-2",
  logger: console,
  transporter: new SCTransporter({socket})
})
broker2.start()
  .then(() => broker2.call("math.add", { a: 5, b: 3 }))
  .then(res => console.log("5 + 3 =", res))
