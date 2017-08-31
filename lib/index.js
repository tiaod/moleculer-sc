'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

var _require = require('./errors');

const UnAuthorizedError = _require.UnAuthorizedError;

const ServiceNotFoundError = require("moleculer").Errors.ServiceNotFoundError;

const debug = require('debug')('moleculer-sc');
module.exports = {
  name: 'sc-gw',
  settings: {
    worker: null,
    acl: null
  },
  created() {
    if (!this.settings.worker) {
      throw new Error('SocketCluster worker not set. You must set the worker.');
    }
    const scServer = this.settings.worker.scServer;
    scServer.on('connection', socket => {
      socket.on('message', this.handler());
    });
  },
  methods: {
    getUserId(socket) {
      if (socket.authToken && socket.authToken.id) {
        return socket.authToken.id;
      }
    },
    getMeta(socket) {
      return {
        user: socket.authToken
      };
    },
    callAction(eventName, params, socket) {
      var _this = this;

      return _asyncToGenerator(function* () {
        if (_this.settings.acl) {
          var _eventName$split = eventName.split('.', 2),
              _eventName$split2 = _slicedToArray(_eventName$split, 2);

          let serviceName = _eventName$split2[0],
              actionName = _eventName$split2[1];

          console.log([serviceName, actionName]);
          let userId = _this.getUserId(socket);
          if (!userId) {
            throw new UnAuthorizedError();
          }
          if (!(yield _this.settings.acl.isAllowed(userId, serviceName, actionName))) {
            throw new ServiceNotFoundError(eventName);
          }
        }
        //create(broker, action, nodeID, params, opts)
        return _this.broker.call(eventName, params, _this.getMeta(socket));
      })();
    },
    handler() {
      const svc = this;
      return (() => {
        var _ref = _asyncToGenerator(function* (msg) {
          if (msg == '#2') return;
          let obj;
          try {
            obj = this.decode(msg);
          } catch (err) {
            svc.logger.debug('received invalid message:', msg);
            return;
          }
          svc.logger.debug('recevied message:', obj);
          if (!obj.event) return;
          if (obj.event.startsWith('#') || !svc.broker.hasAction(obj.event)) return;
          debug('callAction:', obj);
          let respond = { //响应的内容
            rid: obj.cid //回调函数的id
          };
          try {
            respond.data = yield svc.callAction(obj.event, obj.data, this);
          } catch (err) {
            svc.logger.error("  Request error!", err.name, ":", err.message, "\n", err.stack, "\nData:", err.data);
            respond.error = err;
          }
          this.send(this.encode(respond));
        });

        return function (_x) {
          return _ref.apply(this, arguments);
        };
      })();
    }
  }
};