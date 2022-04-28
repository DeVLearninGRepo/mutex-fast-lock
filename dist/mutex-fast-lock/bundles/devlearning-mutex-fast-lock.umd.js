(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('@angular/core'), require('rxjs')) :
    typeof define === 'function' && define.amd ? define('@devlearning/mutex-fast-lock', ['exports', '@angular/core', 'rxjs'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory((global.devlearning = global.devlearning || {}, global.devlearning['mutex-fast-lock'] = {}), global.ng.core, global.rxjs));
}(this, (function (exports, i0, rxjs) { 'use strict';

    function _interopNamespace(e) {
        if (e && e.__esModule) return e;
        var n = Object.create(null);
        if (e) {
            Object.keys(e).forEach(function (k) {
                if (k !== 'default') {
                    var d = Object.getOwnPropertyDescriptor(e, k);
                    Object.defineProperty(n, k, d.get ? d : {
                        enumerable: true,
                        get: function () {
                            return e[k];
                        }
                    });
                }
            });
        }
        n['default'] = e;
        return Object.freeze(n);
    }

    var i0__namespace = /*#__PURE__*/_interopNamespace(i0);

    var MutexFastLockConfig = /** @class */ (function () {
        function MutexFastLockConfig() {
        }
        return MutexFastLockConfig;
    }());

    var MutexLockStats = /** @class */ (function () {
        function MutexLockStats() {
        }
        return MutexLockStats;
    }());

    var MUTEX_FAST_LOCK_CONFIG = new i0.InjectionToken('MUTEX_FAST_LOCK_CONFIG');

    var LockItem = /** @class */ (function () {
        function LockItem() {
        }
        return LockItem;
    }());

    var MutexFastLockService = /** @class */ (function () {
        function MutexFastLockService(_config) {
            this._config = _config;
            this._clientId = this._generateRandomId();
            this._xPrefix = _config.lockPrefix + '_X_';
            this._yPrefix = _config.lockPrefix + '_Y_';
            var that = this;
            window.addEventListener("beforeunload", function (ev) {
                var arr = [];
                for (var i = 0; i < localStorage.length; i++) {
                    if (localStorage.key(i).indexOf(that._xPrefix) == 0
                        || localStorage.key(i).indexOf(that._yPrefix) == 0) {
                        arr.push(localStorage.key(i));
                    }
                }
                for (var i = 0; i < arr.length; i++) {
                    localStorage.removeItem(arr[i]);
                }
            });
        }
        MutexFastLockService.prototype.lock = function (key, timeout) {
            if (timeout === void 0) { timeout = -1; }
            var _a;
            var that = this;
            if (timeout == -1)
                timeout = this._config.timeout;
            var xLock = that._xPrefix + key;
            var yLock = that._yPrefix + key;
            var lockStats = new MutexLockStats();
            that.resetStats(lockStats);
            (_a = this._config.debugEnabled) !== null && _a !== void 0 ? _a : console.debug('Attempting to acquire Lock on "%s" using FastMutex instance "%s"', key, this._clientId);
            lockStats.acquireStart = new Date().getTime();
            //return new Promise(function (resolve, reject) {
            return new rxjs.Observable(function (subscriber) {
                // we need to differentiate between API calls to lock() and our internal
                // recursive calls so that we can timeout based on the original lock() and
                // not each subsequent call.  Therefore, create a new function here within
                // the promise closure that we use for subsequent calls:
                var acquireLock = function acquireLock(key) {
                    var _a, _b, _c, _d;
                    that._releaseExpiredLock(xLock);
                    that._releaseExpiredLock(yLock);
                    var elapsedTime = new Date().getTime() - lockStats.acquireStart;
                    if (elapsedTime >= timeout) {
                        (_a = that._config.debugEnabled) !== null && _a !== void 0 ? _a : console.debug('Lock on "%s" could not be acquired within %sms by FastMutex client "%s"', key, timeout, that._clientId);
                        subscriber.error(new Error('Lock could not be acquired within ' + timeout + 'ms'));
                    }
                    that._setItem(xLock, that._clientId, timeout);
                    // if y exists, another client is getting a lock, so retry in a bit
                    var lsY = that._getItem(yLock, timeout);
                    if (lsY) {
                        (_b = that._config.debugEnabled) !== null && _b !== void 0 ? _b : console.debug('Lock exists on Y (%s), restarting...', lsY);
                        lockStats.restartCount++;
                        setTimeout(function () {
                            return acquireLock(key);
                        }, 10);
                        return;
                    }
                    // ask for inner lock
                    that._setItem(yLock, that._clientId, timeout);
                    // if x was changed, another client is contending for an inner lock
                    var lsX = that._getItem(xLock, timeout);
                    if (lsX !== that._clientId) {
                        lockStats.contentionCount++;
                        (_c = that._config.debugEnabled) !== null && _c !== void 0 ? _c : console.debug('Lock contention detected. X="%s"', lsX);
                        // Give enough time for critical section:
                        setTimeout(function () {
                            var _a, _b;
                            lsY = that._getItem(yLock, timeout);
                            if (lsY === that._clientId) {
                                // we have a lock
                                (_a = that._config.debugEnabled) !== null && _a !== void 0 ? _a : console.debug('FastMutex client "%s" won the lock contention on "%s"', that._clientId, key);
                                that.resolveWithStats(subscriber, lockStats);
                            }
                            else {
                                // we lost the lock, restart the process again
                                lockStats.restartCount++;
                                lockStats.locksLost++;
                                (_b = that._config.debugEnabled) !== null && _b !== void 0 ? _b : console.debug('FastMutex client "%s" lost the lock contention on "%s" to another process (%s). Restarting...', that._clientId, key, lsY);
                                setTimeout(function () {
                                    return acquireLock(key);
                                }, 10);
                            }
                        }, 100);
                        return;
                    }
                    // no contention:
                    (_d = that._config.debugEnabled) !== null && _d !== void 0 ? _d : console.debug('FastMutex client "%s" acquired a lock on "%s" with no contention', that._clientId, key);
                    that.resolveWithStats(subscriber, lockStats);
                };
                acquireLock(key);
            });
        };
        MutexFastLockService.prototype.release = function (key) {
            var _a;
            (_a = this._config.debugEnabled) !== null && _a !== void 0 ? _a : console.debug('FastMutex client "%s" is releasing lock on "%s"', this._clientId, key);
            var x = this._xPrefix + key;
            var y = this._yPrefix + key;
            localStorage.removeItem(x);
            localStorage.removeItem(y);
            //that.lockStats.lockEnd = new Date().getTime();
            //that.lockStats.lockDuration = that.lockStats.lockEnd - that.lockStats.lockStart;
            //let retStats = angular.copy(that.lockStats);
            //that.resetStats();
            //return retStats;
        };
        MutexFastLockService.prototype._generateRandomId = function () {
            return Math.floor(Math.random() * 10000000000) + '';
        };
        MutexFastLockService.prototype.resetStats = function (lockStats) {
            lockStats.restartCount = 0;
            lockStats.locksLost = 0;
            lockStats.contentionCount = 0;
            lockStats.acquireDuration = 0;
            lockStats.acquireStart = null;
        };
        MutexFastLockService.prototype.resolveWithStats = function (subscriber, stats) {
            var currentTime = new Date().getTime();
            stats.acquireEnd = currentTime;
            stats.acquireDuration = stats.acquireEnd - stats.acquireStart;
            stats.lockStart = currentTime;
            subscriber.next(stats);
            subscriber.complete();
        };
        /**
         * Helper function to wrap all values in an object that includes the time (so
         * that we can expire it in the future) and json.stringify's it
         */
        MutexFastLockService.prototype._setItem = function (key, clientId, timeout) {
            var lockItem = new LockItem();
            lockItem.clientId = clientId;
            lockItem.expiresAt = new Date().getTime() + timeout;
            return localStorage.setItem(key, JSON.stringify(lockItem));
        };
        /**
         * Helper function to parse JSON encoded values set in localStorage
         */
        MutexFastLockService.prototype._getItem = function (key, timeout) {
            var _a;
            var item = localStorage.getItem(key);
            if (!item)
                return null;
            var lockItem = JSON.parse(item);
            if (new Date().getTime() - lockItem.expiresAt >= timeout) {
                (_a = this._config.debugEnabled) !== null && _a !== void 0 ? _a : console.debug('FastMutex client "%s" removed an expired record on "%s"', this._clientId, key);
                localStorage.removeItem(key);
                return null;
            }
            return lockItem.clientId;
        };
        MutexFastLockService.prototype._releaseExpiredLock = function (key) {
            var _a;
            var item = localStorage.getItem(key);
            if (!item)
                return null;
            var lockItem = JSON.parse(item);
            if (lockItem.expiresAt <= new Date().getTime()) {
                (_a = this._config.debugEnabled) !== null && _a !== void 0 ? _a : console.debug('FastMutex auto removed an expired record on "%s"', key);
                localStorage.removeItem(key);
            }
        };
        return MutexFastLockService;
    }());
    MutexFastLockService.ɵprov = i0__namespace.ɵɵdefineInjectable({ factory: function MutexFastLockService_Factory() { return new MutexFastLockService(i0__namespace.ɵɵinject(MUTEX_FAST_LOCK_CONFIG)); }, token: MutexFastLockService, providedIn: "root" });
    MutexFastLockService.decorators = [
        { type: i0.Injectable, args: [{
                    providedIn: 'root'
                },] }
    ];
    MutexFastLockService.ctorParameters = function () { return [
        { type: MutexFastLockConfig, decorators: [{ type: i0.Inject, args: [MUTEX_FAST_LOCK_CONFIG,] }] }
    ]; };

    var MutexFastLockModule = /** @class */ (function () {
        function MutexFastLockModule() {
        }
        MutexFastLockModule.forRoot = function (config) {
            return ({
                ngModule: MutexFastLockModule,
                providers: [
                    { provide: MUTEX_FAST_LOCK_CONFIG, useValue: config },
                ]
            });
        };
        return MutexFastLockModule;
    }());
    MutexFastLockModule.decorators = [
        { type: i0.NgModule }
    ];

    /*
     * Public API Surface of cnet-mutex-fast-lock
     */

    /**
     * Generated bundle index. Do not edit.
     */

    exports.MutexFastLockConfig = MutexFastLockConfig;
    exports.MutexFastLockModule = MutexFastLockModule;
    exports.MutexFastLockService = MutexFastLockService;
    exports.MutexLockStats = MutexLockStats;
    exports.ɵa = MUTEX_FAST_LOCK_CONFIG;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=devlearning-mutex-fast-lock.umd.js.map
