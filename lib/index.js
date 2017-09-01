'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const _ = require('lodash');
const debug = require('debug')('moleculer-sc');
const nanomatch = require('nanomatch');
module.exports = {
  name: 'sc-gw',
  settings: {
    worker: null
    // whitelist:[]
  },
  created() {
    if (!this.settings.worker) {
      throw new Error('SocketCluster worker not set. You must set the worker.');
    }
    this.handlers = {};
  },
  started() {
    var _this = this;

    return _asyncToGenerator(function* () {
      const scServer = _this.settings.worker.scServer;
      scServer.on('connection', function (socket) {
        debug('socket connected:', socket);
        for (let action in _this.handlers) {
          socket.on(action, _this.handlers[action]); //attach to socket
        }
      });
    })();
  },
  methods: {
    checkWhitelist(action) {
      return this.settings.whitelist.find(mask => {
        if (_.isString(mask)) {
          return nanomatch.isMatch(action, mask, { unixify: false });
        } else if (_.isRegExp(mask)) {
          return mask.test(action);
        }
      }) != null;
    },
    getPublicActions() {
      var _this2 = this;

      return _asyncToGenerator(function* () {
        let res = yield _this2.broker.call("$node.services", {
          skipInternal: true,
          withActions: true
        });
        let allActions = _.flatMap(res, function (svc) {
          return _.keys(svc.actions);
        });
        if (_this2.settings.whitelist) {
          return allActions.filter(function (action) {
            return _this2.checkWhitelist(action);
          });
        } else {
          return allActions;
        }
      })();
    },
    makeHandler: _.memoize(function (actionName) {
      debug('makeHandler', actionName);
      const svc = this;
      return (() => {
        var _ref = _asyncToGenerator(function* (params, respond) {
          try {
            debug('callAction:', actionName, params, svc.getMeta(this));
            let ret = yield svc.broker.call(actionName, params, {
              meta: svc.getMeta(this)
            });
            respond(null, ret);
          } catch (err) {
            respond(err);
            debug('error:', err);
          }
        });

        return function (_x, _x2) {
          return _ref.apply(this, arguments);
        };
      })();
    }),
    updateHandlers() {
      var _this3 = this;

      return _asyncToGenerator(function* () {
        let actions = yield _this3.getPublicActions();
        let removedActions = _.keys(_this3.handlers).filter(function (item) {
          return !actions.includes(item);
        });
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = removedActions[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            let removed = _step.value;
            //remove old actions
            debug('remove handler:', removed);
            delete _this3.handlers[removedActions];
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }

        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = actions[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            let action = _step2.value;
            //attach new actions
            debug('add handler:', action);
            _this3.handlers[action] = _this3.makeHandler(action);
          }
        } catch (err) {
          _didIteratorError2 = true;
          _iteratorError2 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }
          } finally {
            if (_didIteratorError2) {
              throw _iteratorError2;
            }
          }
        }
      })();
    },
    getMeta(socket) {
      return {
        user: socket.authToken
      };
    }
  },
  events: {
    'services.changed': function servicesChanged(payload, sender) {
      this.updateHandlers();
    }
  }
};