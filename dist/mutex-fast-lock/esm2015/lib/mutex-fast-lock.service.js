import { Inject, Injectable } from '@angular/core';
import { MUTEX_FAST_LOCK_CONFIG } from './mutex-fast-lock-config.injector';
import { MutexFastLockConfig } from './models/mutex-fast-lock-config';
import { MutexLockStats } from './models/mutex-lock-stats';
import { Observable } from 'rxjs';
import { LockItem } from './models/lock-item';
import * as i0 from "@angular/core";
import * as i1 from "./mutex-fast-lock-config.injector";
export class MutexFastLockService {
    constructor(_config) {
        this._config = _config;
        this._clientId = this._generateRandomId();
        this._xPrefix = _config.lockPrefix + '_X_';
        this._yPrefix = _config.lockPrefix + '_Y_';
        let that = this;
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
    lock(key, timeout = -1) {
        var _a;
        let that = this;
        if (timeout == -1)
            timeout = this._config.timeout;
        let xLock = that._xPrefix + key;
        let yLock = that._yPrefix + key;
        let lockStats = new MutexLockStats();
        that.resetStats(lockStats);
        (_a = this._config.debugEnabled) !== null && _a !== void 0 ? _a : console.debug('Attempting to acquire Lock on "%s" using FastMutex instance "%s"', key, this._clientId);
        lockStats.acquireStart = new Date().getTime();
        //return new Promise(function (resolve, reject) {
        return new Observable(subscriber => {
            // we need to differentiate between API calls to lock() and our internal
            // recursive calls so that we can timeout based on the original lock() and
            // not each subsequent call.  Therefore, create a new function here within
            // the promise closure that we use for subsequent calls:
            let acquireLock = function acquireLock(key) {
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
    }
    release(key) {
        var _a;
        (_a = this._config.debugEnabled) !== null && _a !== void 0 ? _a : console.debug('FastMutex client "%s" is releasing lock on "%s"', this._clientId, key);
        let x = this._xPrefix + key;
        let y = this._yPrefix + key;
        localStorage.removeItem(x);
        localStorage.removeItem(y);
        //that.lockStats.lockEnd = new Date().getTime();
        //that.lockStats.lockDuration = that.lockStats.lockEnd - that.lockStats.lockStart;
        //let retStats = angular.copy(that.lockStats);
        //that.resetStats();
        //return retStats;
    }
    _generateRandomId() {
        return Math.floor(Math.random() * 10000000000) + '';
    }
    resetStats(lockStats) {
        lockStats.restartCount = 0;
        lockStats.locksLost = 0;
        lockStats.contentionCount = 0;
        lockStats.acquireDuration = 0;
        lockStats.acquireStart = null;
    }
    resolveWithStats(subscriber, stats) {
        var currentTime = new Date().getTime();
        stats.acquireEnd = currentTime;
        stats.acquireDuration = stats.acquireEnd - stats.acquireStart;
        stats.lockStart = currentTime;
        subscriber.next(stats);
        subscriber.complete();
    }
    /**
     * Helper function to wrap all values in an object that includes the time (so
     * that we can expire it in the future) and json.stringify's it
     */
    _setItem(key, clientId, timeout) {
        let lockItem = new LockItem();
        lockItem.clientId = clientId;
        lockItem.expiresAt = new Date().getTime() + timeout;
        return localStorage.setItem(key, JSON.stringify(lockItem));
    }
    /**
     * Helper function to parse JSON encoded values set in localStorage
     */
    _getItem(key, timeout) {
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
    }
    _releaseExpiredLock(key) {
        var _a;
        var item = localStorage.getItem(key);
        if (!item)
            return null;
        var lockItem = JSON.parse(item);
        if (lockItem.expiresAt <= new Date().getTime()) {
            (_a = this._config.debugEnabled) !== null && _a !== void 0 ? _a : console.debug('FastMutex auto removed an expired record on "%s"', key);
            localStorage.removeItem(key);
        }
    }
}
MutexFastLockService.ɵprov = i0.ɵɵdefineInjectable({ factory: function MutexFastLockService_Factory() { return new MutexFastLockService(i0.ɵɵinject(i1.MUTEX_FAST_LOCK_CONFIG)); }, token: MutexFastLockService, providedIn: "root" });
MutexFastLockService.decorators = [
    { type: Injectable, args: [{
                providedIn: 'root'
            },] }
];
MutexFastLockService.ctorParameters = () => [
    { type: MutexFastLockConfig, decorators: [{ type: Inject, args: [MUTEX_FAST_LOCK_CONFIG,] }] }
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXV0ZXgtZmFzdC1sb2NrLnNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9wcm9qZWN0cy9tdXRleC1mYXN0LWxvY2svc3JjL2xpYi9tdXRleC1mYXN0LWxvY2suc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUNuRCxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUN0RSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDM0QsT0FBTyxFQUFFLFVBQVUsRUFBYyxNQUFNLE1BQU0sQ0FBQztBQUM5QyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7OztBQUs5QyxNQUFNLE9BQU8sb0JBQW9CO0lBTS9CLFlBQ21ELE9BQTRCO1FBQTVCLFlBQU8sR0FBUCxPQUFPLENBQXFCO1FBRTdFLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFDMUMsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztRQUMzQyxJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQyxVQUFVLEdBQUcsS0FBSyxDQUFDO1FBRTNDLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQztRQUNoQixNQUFNLENBQUMsZ0JBQWdCLENBQUMsY0FBYyxFQUFFLFVBQVUsRUFBRTtZQUNsRCxJQUFJLEdBQUcsR0FBRyxFQUFFLENBQUM7WUFFYixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsWUFBWSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFDNUMsSUFBSSxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQzt1QkFDOUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDcEQsR0FBRyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7aUJBQy9CO2FBQ0Y7WUFFRCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFDbkMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUNqQztRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVNLElBQUksQ0FBQyxHQUFXLEVBQUUsVUFBa0IsQ0FBQyxDQUFDOztRQUMzQyxJQUFJLElBQUksR0FBRyxJQUFJLENBQUM7UUFFaEIsSUFBSSxPQUFPLElBQUksQ0FBQyxDQUFDO1lBQUUsT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO1FBRWxELElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxRQUFRLEdBQUcsR0FBRyxDQUFDO1FBQ2hDLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxRQUFRLEdBQUcsR0FBRyxDQUFDO1FBRWhDLElBQUksU0FBUyxHQUFtQixJQUFJLGNBQWMsRUFBRSxDQUFDO1FBRXJELElBQUksQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFM0IsTUFBQSxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksbUNBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxrRUFBa0UsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRXBJLFNBQVMsQ0FBQyxZQUFZLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUU5QyxpREFBaUQ7UUFDakQsT0FBTyxJQUFJLFVBQVUsQ0FBaUIsVUFBVSxDQUFDLEVBQUU7WUFDakQsd0VBQXdFO1lBQ3hFLDBFQUEwRTtZQUMxRSwwRUFBMEU7WUFDMUUsd0RBQXdEO1lBQ3hELElBQUksV0FBVyxHQUFHLFNBQVMsV0FBVyxDQUFDLEdBQUc7O2dCQUV4QyxJQUFJLENBQUMsbUJBQW1CLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ2hDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFFaEMsSUFBSSxXQUFXLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxTQUFTLENBQUMsWUFBWSxDQUFDO2dCQUNoRSxJQUFJLFdBQVcsSUFBSSxPQUFPLEVBQUU7b0JBQzFCLE1BQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLG1DQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUMseUVBQXlFLEVBQUUsR0FBRyxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7b0JBQ3BKLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsb0NBQW9DLEdBQUcsT0FBTyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUM7aUJBQ3BGO2dCQUVELElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBRTlDLG1FQUFtRTtnQkFDbkUsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQ3hDLElBQUksR0FBRyxFQUFFO29CQUNQLE1BQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLG1DQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUMsc0NBQXNDLEVBQUUsR0FBRyxDQUFDLENBQUM7b0JBQ3hGLFNBQVMsQ0FBQyxZQUFZLEVBQUUsQ0FBQztvQkFDekIsVUFBVSxDQUFDO3dCQUNULE9BQU8sV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUMxQixDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQ1AsT0FBTztpQkFDUjtnQkFFRCxxQkFBcUI7Z0JBQ3JCLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBRTlDLG1FQUFtRTtnQkFDbkUsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQ3hDLElBQUksR0FBRyxLQUFLLElBQUksQ0FBQyxTQUFTLEVBQUU7b0JBQzFCLFNBQVMsQ0FBQyxlQUFlLEVBQUUsQ0FBQztvQkFDNUIsTUFBQSxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksbUNBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxrQ0FBa0MsRUFBRSxHQUFHLENBQUMsQ0FBQztvQkFFcEYseUNBQXlDO29CQUN6QyxVQUFVLENBQUM7O3dCQUNULEdBQUcsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQzt3QkFDcEMsSUFBSSxHQUFHLEtBQUssSUFBSSxDQUFDLFNBQVMsRUFBRTs0QkFDMUIsaUJBQWlCOzRCQUNqQixNQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxtQ0FBSSxPQUFPLENBQUMsS0FBSyxDQUFDLHVEQUF1RCxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLENBQUM7NEJBQ3pILElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLEVBQUUsU0FBUyxDQUFDLENBQUM7eUJBQzlDOzZCQUFNOzRCQUNMLDhDQUE4Qzs0QkFDOUMsU0FBUyxDQUFDLFlBQVksRUFBRSxDQUFDOzRCQUN6QixTQUFTLENBQUMsU0FBUyxFQUFFLENBQUM7NEJBQ3RCLE1BQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLG1DQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUMsK0ZBQStGLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7NEJBQ3RLLFVBQVUsQ0FBQztnQ0FDVCxPQUFPLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQzs0QkFDMUIsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO3lCQUNSO29CQUNILENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztvQkFFUixPQUFPO2lCQUNSO2dCQUVELGlCQUFpQjtnQkFDakIsTUFBQSxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksbUNBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxrRUFBa0UsRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2dCQUNwSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQy9DLENBQUMsQ0FBQztZQUVGLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUVuQixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFTSxPQUFPLENBQUMsR0FBRzs7UUFDaEIsTUFBQSxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksbUNBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxpREFBaUQsRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBRW5ILElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxRQUFRLEdBQUcsR0FBRyxDQUFDO1FBQzVCLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxRQUFRLEdBQUcsR0FBRyxDQUFDO1FBQzVCLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDM0IsWUFBWSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUUzQixnREFBZ0Q7UUFDaEQsa0ZBQWtGO1FBRWxGLDhDQUE4QztRQUU5QyxvQkFBb0I7UUFFcEIsa0JBQWtCO0lBQ3BCLENBQUM7SUFFTyxpQkFBaUI7UUFDdkIsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxXQUFXLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDdEQsQ0FBQztJQUVPLFVBQVUsQ0FBQyxTQUF5QjtRQUMxQyxTQUFTLENBQUMsWUFBWSxHQUFHLENBQUMsQ0FBQztRQUMzQixTQUFTLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQztRQUN4QixTQUFTLENBQUMsZUFBZSxHQUFHLENBQUMsQ0FBQztRQUM5QixTQUFTLENBQUMsZUFBZSxHQUFHLENBQUMsQ0FBQztRQUM5QixTQUFTLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQztJQUNoQyxDQUFDO0lBRU8sZ0JBQWdCLENBQUMsVUFBc0MsRUFBRSxLQUFxQjtRQUNwRixJQUFJLFdBQVcsR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3ZDLEtBQUssQ0FBQyxVQUFVLEdBQUcsV0FBVyxDQUFDO1FBQy9CLEtBQUssQ0FBQyxlQUFlLEdBQUcsS0FBSyxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUMsWUFBWSxDQUFDO1FBQzlELEtBQUssQ0FBQyxTQUFTLEdBQUcsV0FBVyxDQUFDO1FBQzlCLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDdkIsVUFBVSxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ3hCLENBQUM7SUFFRDs7O09BR0c7SUFDSyxRQUFRLENBQUMsR0FBRyxFQUFFLFFBQVEsRUFBRSxPQUFPO1FBQ3JDLElBQUksUUFBUSxHQUFHLElBQUksUUFBUSxFQUFFLENBQUM7UUFDOUIsUUFBUSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDN0IsUUFBUSxDQUFDLFNBQVMsR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDLE9BQU8sRUFBRSxHQUFHLE9BQU8sQ0FBQztRQUNwRCxPQUFPLFlBQVksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUM3RCxDQUFDO0lBRUQ7O09BRUc7SUFDSyxRQUFRLENBQUMsR0FBRyxFQUFFLE9BQU87O1FBQzNCLElBQUksSUFBSSxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFckMsSUFBSSxDQUFDLElBQUk7WUFBRSxPQUFPLElBQUksQ0FBQztRQUV2QixJQUFJLFFBQVEsR0FBYSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzFDLElBQUksSUFBSSxJQUFJLEVBQUUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxRQUFRLENBQUMsU0FBUyxJQUFJLE9BQU8sRUFBRTtZQUN4RCxNQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxtQ0FBSSxPQUFPLENBQUMsS0FBSyxDQUFDLHlEQUF5RCxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDM0gsWUFBWSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUM3QixPQUFPLElBQUksQ0FBQztTQUNiO1FBRUQsT0FBTyxRQUFRLENBQUMsUUFBUSxDQUFDO0lBQzNCLENBQUM7SUFFTyxtQkFBbUIsQ0FBQyxHQUFXOztRQUNyQyxJQUFJLElBQUksR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRXJDLElBQUksQ0FBQyxJQUFJO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFFdkIsSUFBSSxRQUFRLEdBQWEsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUUxQyxJQUFJLFFBQVEsQ0FBQyxTQUFTLElBQUksSUFBSSxJQUFJLEVBQUUsQ0FBQyxPQUFPLEVBQUUsRUFBRTtZQUM5QyxNQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxtQ0FBSSxPQUFPLENBQUMsS0FBSyxDQUFDLGtEQUFrRCxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQ3BHLFlBQVksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7U0FDOUI7SUFDSCxDQUFDOzs7O1lBdE1GLFVBQVUsU0FBQztnQkFDVixVQUFVLEVBQUUsTUFBTTthQUNuQjs7O1lBUFEsbUJBQW1CLHVCQWV2QixNQUFNLFNBQUMsc0JBQXNCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSW5qZWN0LCBJbmplY3RhYmxlIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XHJcbmltcG9ydCB7IE1VVEVYX0ZBU1RfTE9DS19DT05GSUcgfSBmcm9tICcuL211dGV4LWZhc3QtbG9jay1jb25maWcuaW5qZWN0b3InO1xyXG5pbXBvcnQgeyBNdXRleEZhc3RMb2NrQ29uZmlnIH0gZnJvbSAnLi9tb2RlbHMvbXV0ZXgtZmFzdC1sb2NrLWNvbmZpZyc7XHJcbmltcG9ydCB7IE11dGV4TG9ja1N0YXRzIH0gZnJvbSAnLi9tb2RlbHMvbXV0ZXgtbG9jay1zdGF0cyc7XHJcbmltcG9ydCB7IE9ic2VydmFibGUsIFN1YnNjcmliZXIgfSBmcm9tICdyeGpzJztcclxuaW1wb3J0IHsgTG9ja0l0ZW0gfSBmcm9tICcuL21vZGVscy9sb2NrLWl0ZW0nO1xyXG5cclxuQEluamVjdGFibGUoe1xyXG4gIHByb3ZpZGVkSW46ICdyb290J1xyXG59KVxyXG5leHBvcnQgY2xhc3MgTXV0ZXhGYXN0TG9ja1NlcnZpY2Uge1xyXG5cclxuICBwcml2YXRlIF9jbGllbnRJZDogc3RyaW5nO1xyXG4gIHByaXZhdGUgX3hQcmVmaXg6IHN0cmluZztcclxuICBwcml2YXRlIF95UHJlZml4OiBzdHJpbmc7XHJcblxyXG4gIGNvbnN0cnVjdG9yKFxyXG4gICAgQEluamVjdChNVVRFWF9GQVNUX0xPQ0tfQ09ORklHKSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWc6IE11dGV4RmFzdExvY2tDb25maWcsXHJcbiAgKSB7XHJcbiAgICB0aGlzLl9jbGllbnRJZCA9IHRoaXMuX2dlbmVyYXRlUmFuZG9tSWQoKTtcclxuICAgIHRoaXMuX3hQcmVmaXggPSBfY29uZmlnLmxvY2tQcmVmaXggKyAnX1hfJztcclxuICAgIHRoaXMuX3lQcmVmaXggPSBfY29uZmlnLmxvY2tQcmVmaXggKyAnX1lfJztcclxuXHJcbiAgICBsZXQgdGhhdCA9IHRoaXM7XHJcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImJlZm9yZXVubG9hZFwiLCBmdW5jdGlvbiAoZXYpIHtcclxuICAgICAgdmFyIGFyciA9IFtdO1xyXG5cclxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsb2NhbFN0b3JhZ2UubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBpZiAobG9jYWxTdG9yYWdlLmtleShpKS5pbmRleE9mKHRoYXQuX3hQcmVmaXgpID09IDBcclxuICAgICAgICAgIHx8IGxvY2FsU3RvcmFnZS5rZXkoaSkuaW5kZXhPZih0aGF0Ll95UHJlZml4KSA9PSAwKSB7XHJcbiAgICAgICAgICBhcnIucHVzaChsb2NhbFN0b3JhZ2Uua2V5KGkpKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oYXJyW2ldKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgbG9jayhrZXk6IHN0cmluZywgdGltZW91dDogbnVtYmVyID0gLTEpIHtcclxuICAgIGxldCB0aGF0ID0gdGhpcztcclxuXHJcbiAgICBpZiAodGltZW91dCA9PSAtMSkgdGltZW91dCA9IHRoaXMuX2NvbmZpZy50aW1lb3V0O1xyXG5cclxuICAgIGxldCB4TG9jayA9IHRoYXQuX3hQcmVmaXggKyBrZXk7XHJcbiAgICBsZXQgeUxvY2sgPSB0aGF0Ll95UHJlZml4ICsga2V5O1xyXG5cclxuICAgIGxldCBsb2NrU3RhdHM6IE11dGV4TG9ja1N0YXRzID0gbmV3IE11dGV4TG9ja1N0YXRzKCk7XHJcblxyXG4gICAgdGhhdC5yZXNldFN0YXRzKGxvY2tTdGF0cyk7XHJcblxyXG4gICAgdGhpcy5fY29uZmlnLmRlYnVnRW5hYmxlZCA/PyBjb25zb2xlLmRlYnVnKCdBdHRlbXB0aW5nIHRvIGFjcXVpcmUgTG9jayBvbiBcIiVzXCIgdXNpbmcgRmFzdE11dGV4IGluc3RhbmNlIFwiJXNcIicsIGtleSwgdGhpcy5fY2xpZW50SWQpO1xyXG5cclxuICAgIGxvY2tTdGF0cy5hY3F1aXJlU3RhcnQgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcclxuXHJcbiAgICAvL3JldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGU8TXV0ZXhMb2NrU3RhdHM+KHN1YnNjcmliZXIgPT4ge1xyXG4gICAgICAvLyB3ZSBuZWVkIHRvIGRpZmZlcmVudGlhdGUgYmV0d2VlbiBBUEkgY2FsbHMgdG8gbG9jaygpIGFuZCBvdXIgaW50ZXJuYWxcclxuICAgICAgLy8gcmVjdXJzaXZlIGNhbGxzIHNvIHRoYXQgd2UgY2FuIHRpbWVvdXQgYmFzZWQgb24gdGhlIG9yaWdpbmFsIGxvY2soKSBhbmRcclxuICAgICAgLy8gbm90IGVhY2ggc3Vic2VxdWVudCBjYWxsLiAgVGhlcmVmb3JlLCBjcmVhdGUgYSBuZXcgZnVuY3Rpb24gaGVyZSB3aXRoaW5cclxuICAgICAgLy8gdGhlIHByb21pc2UgY2xvc3VyZSB0aGF0IHdlIHVzZSBmb3Igc3Vic2VxdWVudCBjYWxsczpcclxuICAgICAgbGV0IGFjcXVpcmVMb2NrID0gZnVuY3Rpb24gYWNxdWlyZUxvY2soa2V5KSB7XHJcblxyXG4gICAgICAgIHRoYXQuX3JlbGVhc2VFeHBpcmVkTG9jayh4TG9jayk7XHJcbiAgICAgICAgdGhhdC5fcmVsZWFzZUV4cGlyZWRMb2NrKHlMb2NrKTtcclxuXHJcbiAgICAgICAgdmFyIGVsYXBzZWRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgLSBsb2NrU3RhdHMuYWNxdWlyZVN0YXJ0O1xyXG4gICAgICAgIGlmIChlbGFwc2VkVGltZSA+PSB0aW1lb3V0KSB7XHJcbiAgICAgICAgICB0aGF0Ll9jb25maWcuZGVidWdFbmFibGVkID8/IGNvbnNvbGUuZGVidWcoJ0xvY2sgb24gXCIlc1wiIGNvdWxkIG5vdCBiZSBhY3F1aXJlZCB3aXRoaW4gJXNtcyBieSBGYXN0TXV0ZXggY2xpZW50IFwiJXNcIicsIGtleSwgdGltZW91dCwgdGhhdC5fY2xpZW50SWQpO1xyXG4gICAgICAgICAgc3Vic2NyaWJlci5lcnJvcihuZXcgRXJyb3IoJ0xvY2sgY291bGQgbm90IGJlIGFjcXVpcmVkIHdpdGhpbiAnICsgdGltZW91dCArICdtcycpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoYXQuX3NldEl0ZW0oeExvY2ssIHRoYXQuX2NsaWVudElkLCB0aW1lb3V0KTtcclxuXHJcbiAgICAgICAgLy8gaWYgeSBleGlzdHMsIGFub3RoZXIgY2xpZW50IGlzIGdldHRpbmcgYSBsb2NrLCBzbyByZXRyeSBpbiBhIGJpdFxyXG4gICAgICAgIHZhciBsc1kgPSB0aGF0Ll9nZXRJdGVtKHlMb2NrLCB0aW1lb3V0KTtcclxuICAgICAgICBpZiAobHNZKSB7XHJcbiAgICAgICAgICB0aGF0Ll9jb25maWcuZGVidWdFbmFibGVkID8/IGNvbnNvbGUuZGVidWcoJ0xvY2sgZXhpc3RzIG9uIFkgKCVzKSwgcmVzdGFydGluZy4uLicsIGxzWSk7XHJcbiAgICAgICAgICBsb2NrU3RhdHMucmVzdGFydENvdW50Kys7XHJcbiAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGFjcXVpcmVMb2NrKGtleSk7XHJcbiAgICAgICAgICB9LCAxMCk7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBhc2sgZm9yIGlubmVyIGxvY2tcclxuICAgICAgICB0aGF0Ll9zZXRJdGVtKHlMb2NrLCB0aGF0Ll9jbGllbnRJZCwgdGltZW91dCk7XHJcblxyXG4gICAgICAgIC8vIGlmIHggd2FzIGNoYW5nZWQsIGFub3RoZXIgY2xpZW50IGlzIGNvbnRlbmRpbmcgZm9yIGFuIGlubmVyIGxvY2tcclxuICAgICAgICB2YXIgbHNYID0gdGhhdC5fZ2V0SXRlbSh4TG9jaywgdGltZW91dCk7XHJcbiAgICAgICAgaWYgKGxzWCAhPT0gdGhhdC5fY2xpZW50SWQpIHtcclxuICAgICAgICAgIGxvY2tTdGF0cy5jb250ZW50aW9uQ291bnQrKztcclxuICAgICAgICAgIHRoYXQuX2NvbmZpZy5kZWJ1Z0VuYWJsZWQgPz8gY29uc29sZS5kZWJ1ZygnTG9jayBjb250ZW50aW9uIGRldGVjdGVkLiBYPVwiJXNcIicsIGxzWCk7XHJcblxyXG4gICAgICAgICAgLy8gR2l2ZSBlbm91Z2ggdGltZSBmb3IgY3JpdGljYWwgc2VjdGlvbjpcclxuICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBsc1kgPSB0aGF0Ll9nZXRJdGVtKHlMb2NrLCB0aW1lb3V0KTtcclxuICAgICAgICAgICAgaWYgKGxzWSA9PT0gdGhhdC5fY2xpZW50SWQpIHtcclxuICAgICAgICAgICAgICAvLyB3ZSBoYXZlIGEgbG9ja1xyXG4gICAgICAgICAgICAgIHRoYXQuX2NvbmZpZy5kZWJ1Z0VuYWJsZWQgPz8gY29uc29sZS5kZWJ1ZygnRmFzdE11dGV4IGNsaWVudCBcIiVzXCIgd29uIHRoZSBsb2NrIGNvbnRlbnRpb24gb24gXCIlc1wiJywgdGhhdC5fY2xpZW50SWQsIGtleSk7XHJcbiAgICAgICAgICAgICAgdGhhdC5yZXNvbHZlV2l0aFN0YXRzKHN1YnNjcmliZXIsIGxvY2tTdGF0cyk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgLy8gd2UgbG9zdCB0aGUgbG9jaywgcmVzdGFydCB0aGUgcHJvY2VzcyBhZ2FpblxyXG4gICAgICAgICAgICAgIGxvY2tTdGF0cy5yZXN0YXJ0Q291bnQrKztcclxuICAgICAgICAgICAgICBsb2NrU3RhdHMubG9ja3NMb3N0Kys7XHJcbiAgICAgICAgICAgICAgdGhhdC5fY29uZmlnLmRlYnVnRW5hYmxlZCA/PyBjb25zb2xlLmRlYnVnKCdGYXN0TXV0ZXggY2xpZW50IFwiJXNcIiBsb3N0IHRoZSBsb2NrIGNvbnRlbnRpb24gb24gXCIlc1wiIHRvIGFub3RoZXIgcHJvY2VzcyAoJXMpLiBSZXN0YXJ0aW5nLi4uJywgdGhhdC5fY2xpZW50SWQsIGtleSwgbHNZKTtcclxuICAgICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBhY3F1aXJlTG9jayhrZXkpO1xyXG4gICAgICAgICAgICAgIH0sIDEwKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSwgMTAwKTtcclxuXHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBubyBjb250ZW50aW9uOlxyXG4gICAgICAgIHRoYXQuX2NvbmZpZy5kZWJ1Z0VuYWJsZWQgPz8gY29uc29sZS5kZWJ1ZygnRmFzdE11dGV4IGNsaWVudCBcIiVzXCIgYWNxdWlyZWQgYSBsb2NrIG9uIFwiJXNcIiB3aXRoIG5vIGNvbnRlbnRpb24nLCB0aGF0Ll9jbGllbnRJZCwga2V5KTtcclxuICAgICAgICB0aGF0LnJlc29sdmVXaXRoU3RhdHMoc3Vic2NyaWJlciwgbG9ja1N0YXRzKTtcclxuICAgICAgfTtcclxuXHJcbiAgICAgIGFjcXVpcmVMb2NrKGtleSk7XHJcblxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgcmVsZWFzZShrZXkpIHtcclxuICAgIHRoaXMuX2NvbmZpZy5kZWJ1Z0VuYWJsZWQgPz8gY29uc29sZS5kZWJ1ZygnRmFzdE11dGV4IGNsaWVudCBcIiVzXCIgaXMgcmVsZWFzaW5nIGxvY2sgb24gXCIlc1wiJywgdGhpcy5fY2xpZW50SWQsIGtleSk7XHJcblxyXG4gICAgbGV0IHggPSB0aGlzLl94UHJlZml4ICsga2V5O1xyXG4gICAgbGV0IHkgPSB0aGlzLl95UHJlZml4ICsga2V5O1xyXG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oeCk7XHJcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSh5KTtcclxuXHJcbiAgICAvL3RoYXQubG9ja1N0YXRzLmxvY2tFbmQgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcclxuICAgIC8vdGhhdC5sb2NrU3RhdHMubG9ja0R1cmF0aW9uID0gdGhhdC5sb2NrU3RhdHMubG9ja0VuZCAtIHRoYXQubG9ja1N0YXRzLmxvY2tTdGFydDtcclxuXHJcbiAgICAvL2xldCByZXRTdGF0cyA9IGFuZ3VsYXIuY29weSh0aGF0LmxvY2tTdGF0cyk7XHJcblxyXG4gICAgLy90aGF0LnJlc2V0U3RhdHMoKTtcclxuXHJcbiAgICAvL3JldHVybiByZXRTdGF0cztcclxuICB9XHJcblxyXG4gIHByaXZhdGUgX2dlbmVyYXRlUmFuZG9tSWQoKSB7XHJcbiAgICByZXR1cm4gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDAwMDAwMDApICsgJyc7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlc2V0U3RhdHMobG9ja1N0YXRzOiBNdXRleExvY2tTdGF0cykge1xyXG4gICAgbG9ja1N0YXRzLnJlc3RhcnRDb3VudCA9IDA7XHJcbiAgICBsb2NrU3RhdHMubG9ja3NMb3N0ID0gMDtcclxuICAgIGxvY2tTdGF0cy5jb250ZW50aW9uQ291bnQgPSAwO1xyXG4gICAgbG9ja1N0YXRzLmFjcXVpcmVEdXJhdGlvbiA9IDA7XHJcbiAgICBsb2NrU3RhdHMuYWNxdWlyZVN0YXJ0ID0gbnVsbDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVzb2x2ZVdpdGhTdGF0cyhzdWJzY3JpYmVyOiBTdWJzY3JpYmVyPE11dGV4TG9ja1N0YXRzPiwgc3RhdHM6IE11dGV4TG9ja1N0YXRzKSB7XHJcbiAgICB2YXIgY3VycmVudFRpbWUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcclxuICAgIHN0YXRzLmFjcXVpcmVFbmQgPSBjdXJyZW50VGltZTtcclxuICAgIHN0YXRzLmFjcXVpcmVEdXJhdGlvbiA9IHN0YXRzLmFjcXVpcmVFbmQgLSBzdGF0cy5hY3F1aXJlU3RhcnQ7XHJcbiAgICBzdGF0cy5sb2NrU3RhcnQgPSBjdXJyZW50VGltZTtcclxuICAgIHN1YnNjcmliZXIubmV4dChzdGF0cyk7XHJcbiAgICBzdWJzY3JpYmVyLmNvbXBsZXRlKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIZWxwZXIgZnVuY3Rpb24gdG8gd3JhcCBhbGwgdmFsdWVzIGluIGFuIG9iamVjdCB0aGF0IGluY2x1ZGVzIHRoZSB0aW1lIChzb1xyXG4gICAqIHRoYXQgd2UgY2FuIGV4cGlyZSBpdCBpbiB0aGUgZnV0dXJlKSBhbmQganNvbi5zdHJpbmdpZnkncyBpdFxyXG4gICAqL1xyXG4gIHByaXZhdGUgX3NldEl0ZW0oa2V5LCBjbGllbnRJZCwgdGltZW91dCkge1xyXG4gICAgbGV0IGxvY2tJdGVtID0gbmV3IExvY2tJdGVtKCk7XHJcbiAgICBsb2NrSXRlbS5jbGllbnRJZCA9IGNsaWVudElkO1xyXG4gICAgbG9ja0l0ZW0uZXhwaXJlc0F0ID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgKyB0aW1lb3V0O1xyXG4gICAgcmV0dXJuIGxvY2FsU3RvcmFnZS5zZXRJdGVtKGtleSwgSlNPTi5zdHJpbmdpZnkobG9ja0l0ZW0pKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhlbHBlciBmdW5jdGlvbiB0byBwYXJzZSBKU09OIGVuY29kZWQgdmFsdWVzIHNldCBpbiBsb2NhbFN0b3JhZ2VcclxuICAgKi9cclxuICBwcml2YXRlIF9nZXRJdGVtKGtleSwgdGltZW91dCkge1xyXG4gICAgdmFyIGl0ZW0gPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShrZXkpO1xyXG5cclxuICAgIGlmICghaXRlbSkgcmV0dXJuIG51bGw7XHJcblxyXG4gICAgdmFyIGxvY2tJdGVtID0gPExvY2tJdGVtPkpTT04ucGFyc2UoaXRlbSk7XHJcbiAgICBpZiAobmV3IERhdGUoKS5nZXRUaW1lKCkgLSBsb2NrSXRlbS5leHBpcmVzQXQgPj0gdGltZW91dCkge1xyXG4gICAgICB0aGlzLl9jb25maWcuZGVidWdFbmFibGVkID8/IGNvbnNvbGUuZGVidWcoJ0Zhc3RNdXRleCBjbGllbnQgXCIlc1wiIHJlbW92ZWQgYW4gZXhwaXJlZCByZWNvcmQgb24gXCIlc1wiJywgdGhpcy5fY2xpZW50SWQsIGtleSk7XHJcbiAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKGtleSk7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBsb2NrSXRlbS5jbGllbnRJZDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgX3JlbGVhc2VFeHBpcmVkTG9jayhrZXk6IHN0cmluZyl7XHJcbiAgICB2YXIgaXRlbSA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKGtleSk7XHJcblxyXG4gICAgaWYgKCFpdGVtKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgICB2YXIgbG9ja0l0ZW0gPSA8TG9ja0l0ZW0+SlNPTi5wYXJzZShpdGVtKTtcclxuXHJcbiAgICBpZiAobG9ja0l0ZW0uZXhwaXJlc0F0IDw9IG5ldyBEYXRlKCkuZ2V0VGltZSgpKSB7XHJcbiAgICAgIHRoaXMuX2NvbmZpZy5kZWJ1Z0VuYWJsZWQgPz8gY29uc29sZS5kZWJ1ZygnRmFzdE11dGV4IGF1dG8gcmVtb3ZlZCBhbiBleHBpcmVkIHJlY29yZCBvbiBcIiVzXCInLCBrZXkpO1xyXG4gICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShrZXkpO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iXX0=