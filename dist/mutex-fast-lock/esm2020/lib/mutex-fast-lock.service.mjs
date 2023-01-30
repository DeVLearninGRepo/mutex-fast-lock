import { Inject, Injectable } from '@angular/core';
import { MUTEX_FAST_LOCK_CONFIG } from './mutex-fast-lock-config.injector';
import { MutexLockStats } from './models/mutex-lock-stats';
import { Observable } from 'rxjs';
import { LockItem } from './models/lock-item';
import * as i0 from "@angular/core";
import * as i1 from "./models/mutex-fast-lock-config";
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
        let that = this;
        if (timeout == -1)
            timeout = this._config.timeout;
        let xLock = that._xPrefix + key;
        let yLock = that._yPrefix + key;
        let lockStats = new MutexLockStats();
        that.resetStats(lockStats);
        this._config.debugEnabled ?? console.debug('Attempting to acquire Lock on "%s" using FastMutex instance "%s"', key, this._clientId);
        lockStats.acquireStart = new Date().getTime();
        //return new Promise(function (resolve, reject) {
        return new Observable(subscriber => {
            // we need to differentiate between API calls to lock() and our internal
            // recursive calls so that we can timeout based on the original lock() and
            // not each subsequent call.  Therefore, create a new function here within
            // the promise closure that we use for subsequent calls:
            let acquireLock = function acquireLock(key) {
                that._releaseExpiredLock(xLock);
                that._releaseExpiredLock(yLock);
                var elapsedTime = new Date().getTime() - lockStats.acquireStart;
                if (elapsedTime >= timeout) {
                    that._config.debugEnabled ?? console.debug('Lock on "%s" could not be acquired within %sms by FastMutex client "%s"', key, timeout, that._clientId);
                    subscriber.error(new Error('Lock could not be acquired within ' + timeout + 'ms'));
                }
                that._setItem(xLock, that._clientId, timeout);
                // if y exists, another client is getting a lock, so retry in a bit
                var lsY = that._getItem(yLock, timeout);
                if (lsY) {
                    that._config.debugEnabled ?? console.debug('Lock exists on Y (%s), restarting...', lsY);
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
                    that._config.debugEnabled ?? console.debug('Lock contention detected. X="%s"', lsX);
                    // Give enough time for critical section:
                    setTimeout(function () {
                        lsY = that._getItem(yLock, timeout);
                        if (lsY === that._clientId) {
                            // we have a lock
                            that._config.debugEnabled ?? console.debug('FastMutex client "%s" won the lock contention on "%s"', that._clientId, key);
                            that.resolveWithStats(subscriber, lockStats);
                        }
                        else {
                            // we lost the lock, restart the process again
                            lockStats.restartCount++;
                            lockStats.locksLost++;
                            that._config.debugEnabled ?? console.debug('FastMutex client "%s" lost the lock contention on "%s" to another process (%s). Restarting...', that._clientId, key, lsY);
                            setTimeout(function () {
                                return acquireLock(key);
                            }, 10);
                        }
                    }, 100);
                    return;
                }
                // no contention:
                that._config.debugEnabled ?? console.debug('FastMutex client "%s" acquired a lock on "%s" with no contention', that._clientId, key);
                that.resolveWithStats(subscriber, lockStats);
            };
            acquireLock(key);
        });
    }
    release(key) {
        this._config.debugEnabled ?? console.debug('FastMutex client "%s" is releasing lock on "%s"', this._clientId, key);
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
        var item = localStorage.getItem(key);
        if (!item)
            return null;
        var lockItem = JSON.parse(item);
        if (new Date().getTime() - lockItem.expiresAt >= timeout) {
            this._config.debugEnabled ?? console.debug('FastMutex client "%s" removed an expired record on "%s"', this._clientId, key);
            localStorage.removeItem(key);
            return null;
        }
        return lockItem.clientId;
    }
    _releaseExpiredLock(key) {
        var item = localStorage.getItem(key);
        if (!item)
            return null;
        var lockItem = JSON.parse(item);
        if (lockItem.expiresAt <= new Date().getTime()) {
            this._config.debugEnabled ?? console.debug('FastMutex auto removed an expired record on "%s"', key);
            localStorage.removeItem(key);
        }
    }
}
MutexFastLockService.ɵfac = function MutexFastLockService_Factory(t) { return new (t || MutexFastLockService)(i0.ɵɵinject(MUTEX_FAST_LOCK_CONFIG)); };
MutexFastLockService.ɵprov = /*@__PURE__*/ i0.ɵɵdefineInjectable({ token: MutexFastLockService, factory: MutexFastLockService.ɵfac, providedIn: 'root' });
(function () { (typeof ngDevMode === "undefined" || ngDevMode) && i0.ɵsetClassMetadata(MutexFastLockService, [{
        type: Injectable,
        args: [{
                providedIn: 'root'
            }]
    }], function () { return [{ type: i1.MutexFastLockConfig, decorators: [{
                type: Inject,
                args: [MUTEX_FAST_LOCK_CONFIG]
            }] }]; }, null); })();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXV0ZXgtZmFzdC1sb2NrLnNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9wcm9qZWN0cy9tdXRleC1mYXN0LWxvY2svc3JjL2xpYi9tdXRleC1mYXN0LWxvY2suc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUNuRCxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUUzRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDM0QsT0FBTyxFQUFFLFVBQVUsRUFBYyxNQUFNLE1BQU0sQ0FBQztBQUM5QyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7OztBQUs5QyxNQUFNLE9BQU8sb0JBQW9CO0lBTS9CLFlBQ21ELE9BQTRCO1FBQTVCLFlBQU8sR0FBUCxPQUFPLENBQXFCO1FBRTdFLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFDMUMsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztRQUMzQyxJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQyxVQUFVLEdBQUcsS0FBSyxDQUFDO1FBRTNDLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQztRQUNoQixNQUFNLENBQUMsZ0JBQWdCLENBQUMsY0FBYyxFQUFFLFVBQVUsRUFBRTtZQUNsRCxJQUFJLEdBQUcsR0FBRyxFQUFFLENBQUM7WUFFYixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsWUFBWSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFDNUMsSUFBSSxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElB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QztRQUMxQyxJQUFJLElBQUksSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFLEdBQUcsUUFBUSxDQUFDLFNBQVMsSUFBSSxPQUFPLEVBQUU7WUFDeEQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyx5REFBeUQsRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQzNILFlBQVksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDN0IsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUVELE9BQU8sUUFBUSxDQUFDLFFBQVEsQ0FBQztJQUMzQixDQUFDO0lBRU8sbUJBQW1CLENBQUMsR0FBVztRQUNyQyxJQUFJLElBQUksR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRXJDLElBQUksQ0FBQyxJQUFJO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFFdkIsSUFBSSxRQUFRLEdBQWEsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUUxQyxJQUFJLFFBQVEsQ0FBQyxTQUFTLElBQUksSUFBSSxJQUFJLEVBQUUsQ0FBQyxPQUFPLEVBQUUsRUFBRTtZQUM5QyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLGtEQUFrRCxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQ3BHLFlBQVksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7U0FDOUI7SUFDSCxDQUFDOzt3RkFuTVUsb0JBQW9CLGNBT3JCLHNCQUFzQjswRUFQckIsb0JBQW9CLFdBQXBCLG9CQUFvQixtQkFGbkIsTUFBTTt1RkFFUCxvQkFBb0I7Y0FIaEMsVUFBVTtlQUFDO2dCQUNWLFVBQVUsRUFBRSxNQUFNO2FBQ25COztzQkFRSSxNQUFNO3VCQUFDLHNCQUFzQiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEluamVjdCwgSW5qZWN0YWJsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgTVVURVhfRkFTVF9MT0NLX0NPTkZJRyB9IGZyb20gJy4vbXV0ZXgtZmFzdC1sb2NrLWNvbmZpZy5pbmplY3Rvcic7XG5pbXBvcnQgeyBNdXRleEZhc3RMb2NrQ29uZmlnIH0gZnJvbSAnLi9tb2RlbHMvbXV0ZXgtZmFzdC1sb2NrLWNvbmZpZyc7XG5pbXBvcnQgeyBNdXRleExvY2tTdGF0cyB9IGZyb20gJy4vbW9kZWxzL211dGV4LWxvY2stc3RhdHMnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgU3Vic2NyaWJlciB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgTG9ja0l0ZW0gfSBmcm9tICcuL21vZGVscy9sb2NrLWl0ZW0nO1xuXG5ASW5qZWN0YWJsZSh7XG4gIHByb3ZpZGVkSW46ICdyb290J1xufSlcbmV4cG9ydCBjbGFzcyBNdXRleEZhc3RMb2NrU2VydmljZSB7XG5cbiAgcHJpdmF0ZSBfY2xpZW50SWQ6IHN0cmluZztcbiAgcHJpdmF0ZSBfeFByZWZpeDogc3RyaW5nO1xuICBwcml2YXRlIF95UHJlZml4OiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgQEluamVjdChNVVRFWF9GQVNUX0xPQ0tfQ09ORklHKSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWc6IE11dGV4RmFzdExvY2tDb25maWcsXG4gICkge1xuICAgIHRoaXMuX2NsaWVudElkID0gdGhpcy5fZ2VuZXJhdGVSYW5kb21JZCgpO1xuICAgIHRoaXMuX3hQcmVmaXggPSBfY29uZmlnLmxvY2tQcmVmaXggKyAnX1hfJztcbiAgICB0aGlzLl95UHJlZml4ID0gX2NvbmZpZy5sb2NrUHJlZml4ICsgJ19ZXyc7XG5cbiAgICBsZXQgdGhhdCA9IHRoaXM7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJiZWZvcmV1bmxvYWRcIiwgZnVuY3Rpb24gKGV2KSB7XG4gICAgICB2YXIgYXJyID0gW107XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbG9jYWxTdG9yYWdlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChsb2NhbFN0b3JhZ2Uua2V5KGkpLmluZGV4T2YodGhhdC5feFByZWZpeCkgPT0gMFxuICAgICAgICAgIHx8IGxvY2FsU3RvcmFnZS5rZXkoaSkuaW5kZXhPZih0aGF0Ll95UHJlZml4KSA9PSAwKSB7XG4gICAgICAgICAgYXJyLnB1c2gobG9jYWxTdG9yYWdlLmtleShpKSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oYXJyW2ldKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBsb2NrKGtleTogc3RyaW5nLCB0aW1lb3V0OiBudW1iZXIgPSAtMSkge1xuICAgIGxldCB0aGF0ID0gdGhpcztcblxuICAgIGlmICh0aW1lb3V0ID09IC0xKSB0aW1lb3V0ID0gdGhpcy5fY29uZmlnLnRpbWVvdXQ7XG5cbiAgICBsZXQgeExvY2sgPSB0aGF0Ll94UHJlZml4ICsga2V5O1xuICAgIGxldCB5TG9jayA9IHRoYXQuX3lQcmVmaXggKyBrZXk7XG5cbiAgICBsZXQgbG9ja1N0YXRzOiBNdXRleExvY2tTdGF0cyA9IG5ldyBNdXRleExvY2tTdGF0cygpO1xuXG4gICAgdGhhdC5yZXNldFN0YXRzKGxvY2tTdGF0cyk7XG5cbiAgICB0aGlzLl9jb25maWcuZGVidWdFbmFibGVkID8/IGNvbnNvbGUuZGVidWcoJ0F0dGVtcHRpbmcgdG8gYWNxdWlyZSBMb2NrIG9uIFwiJXNcIiB1c2luZyBGYXN0TXV0ZXggaW5zdGFuY2UgXCIlc1wiJywga2V5LCB0aGlzLl9jbGllbnRJZCk7XG5cbiAgICBsb2NrU3RhdHMuYWNxdWlyZVN0YXJ0ID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG5cbiAgICAvL3JldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlPE11dGV4TG9ja1N0YXRzPihzdWJzY3JpYmVyID0+IHtcbiAgICAgIC8vIHdlIG5lZWQgdG8gZGlmZmVyZW50aWF0ZSBiZXR3ZWVuIEFQSSBjYWxscyB0byBsb2NrKCkgYW5kIG91ciBpbnRlcm5hbFxuICAgICAgLy8gcmVjdXJzaXZlIGNhbGxzIHNvIHRoYXQgd2UgY2FuIHRpbWVvdXQgYmFzZWQgb24gdGhlIG9yaWdpbmFsIGxvY2soKSBhbmRcbiAgICAgIC8vIG5vdCBlYWNoIHN1YnNlcXVlbnQgY2FsbC4gIFRoZXJlZm9yZSwgY3JlYXRlIGEgbmV3IGZ1bmN0aW9uIGhlcmUgd2l0aGluXG4gICAgICAvLyB0aGUgcHJvbWlzZSBjbG9zdXJlIHRoYXQgd2UgdXNlIGZvciBzdWJzZXF1ZW50IGNhbGxzOlxuICAgICAgbGV0IGFjcXVpcmVMb2NrID0gZnVuY3Rpb24gYWNxdWlyZUxvY2soa2V5KSB7XG5cbiAgICAgICAgdGhhdC5fcmVsZWFzZUV4cGlyZWRMb2NrKHhMb2NrKTtcbiAgICAgICAgdGhhdC5fcmVsZWFzZUV4cGlyZWRMb2NrKHlMb2NrKTtcblxuICAgICAgICB2YXIgZWxhcHNlZFRpbWUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIGxvY2tTdGF0cy5hY3F1aXJlU3RhcnQ7XG4gICAgICAgIGlmIChlbGFwc2VkVGltZSA+PSB0aW1lb3V0KSB7XG4gICAgICAgICAgdGhhdC5fY29uZmlnLmRlYnVnRW5hYmxlZCA/PyBjb25zb2xlLmRlYnVnKCdMb2NrIG9uIFwiJXNcIiBjb3VsZCBub3QgYmUgYWNxdWlyZWQgd2l0aGluICVzbXMgYnkgRmFzdE11dGV4IGNsaWVudCBcIiVzXCInLCBrZXksIHRpbWVvdXQsIHRoYXQuX2NsaWVudElkKTtcbiAgICAgICAgICBzdWJzY3JpYmVyLmVycm9yKG5ldyBFcnJvcignTG9jayBjb3VsZCBub3QgYmUgYWNxdWlyZWQgd2l0aGluICcgKyB0aW1lb3V0ICsgJ21zJykpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhhdC5fc2V0SXRlbSh4TG9jaywgdGhhdC5fY2xpZW50SWQsIHRpbWVvdXQpO1xuXG4gICAgICAgIC8vIGlmIHkgZXhpc3RzLCBhbm90aGVyIGNsaWVudCBpcyBnZXR0aW5nIGEgbG9jaywgc28gcmV0cnkgaW4gYSBiaXRcbiAgICAgICAgdmFyIGxzWSA9IHRoYXQuX2dldEl0ZW0oeUxvY2ssIHRpbWVvdXQpO1xuICAgICAgICBpZiAobHNZKSB7XG4gICAgICAgICAgdGhhdC5fY29uZmlnLmRlYnVnRW5hYmxlZCA/PyBjb25zb2xlLmRlYnVnKCdMb2NrIGV4aXN0cyBvbiBZICglcyksIHJlc3RhcnRpbmcuLi4nLCBsc1kpO1xuICAgICAgICAgIGxvY2tTdGF0cy5yZXN0YXJ0Q291bnQrKztcbiAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBhY3F1aXJlTG9jayhrZXkpO1xuICAgICAgICAgIH0sIDEwKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhc2sgZm9yIGlubmVyIGxvY2tcbiAgICAgICAgdGhhdC5fc2V0SXRlbSh5TG9jaywgdGhhdC5fY2xpZW50SWQsIHRpbWVvdXQpO1xuXG4gICAgICAgIC8vIGlmIHggd2FzIGNoYW5nZWQsIGFub3RoZXIgY2xpZW50IGlzIGNvbnRlbmRpbmcgZm9yIGFuIGlubmVyIGxvY2tcbiAgICAgICAgdmFyIGxzWCA9IHRoYXQuX2dldEl0ZW0oeExvY2ssIHRpbWVvdXQpO1xuICAgICAgICBpZiAobHNYICE9PSB0aGF0Ll9jbGllbnRJZCkge1xuICAgICAgICAgIGxvY2tTdGF0cy5jb250ZW50aW9uQ291bnQrKztcbiAgICAgICAgICB0aGF0Ll9jb25maWcuZGVidWdFbmFibGVkID8/IGNvbnNvbGUuZGVidWcoJ0xvY2sgY29udGVudGlvbiBkZXRlY3RlZC4gWD1cIiVzXCInLCBsc1gpO1xuXG4gICAgICAgICAgLy8gR2l2ZSBlbm91Z2ggdGltZSBmb3IgY3JpdGljYWwgc2VjdGlvbjpcbiAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGxzWSA9IHRoYXQuX2dldEl0ZW0oeUxvY2ssIHRpbWVvdXQpO1xuICAgICAgICAgICAgaWYgKGxzWSA9PT0gdGhhdC5fY2xpZW50SWQpIHtcbiAgICAgICAgICAgICAgLy8gd2UgaGF2ZSBhIGxvY2tcbiAgICAgICAgICAgICAgdGhhdC5fY29uZmlnLmRlYnVnRW5hYmxlZCA/PyBjb25zb2xlLmRlYnVnKCdGYXN0TXV0ZXggY2xpZW50IFwiJXNcIiB3b24gdGhlIGxvY2sgY29udGVudGlvbiBvbiBcIiVzXCInLCB0aGF0Ll9jbGllbnRJZCwga2V5KTtcbiAgICAgICAgICAgICAgdGhhdC5yZXNvbHZlV2l0aFN0YXRzKHN1YnNjcmliZXIsIGxvY2tTdGF0cyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyB3ZSBsb3N0IHRoZSBsb2NrLCByZXN0YXJ0IHRoZSBwcm9jZXNzIGFnYWluXG4gICAgICAgICAgICAgIGxvY2tTdGF0cy5yZXN0YXJ0Q291bnQrKztcbiAgICAgICAgICAgICAgbG9ja1N0YXRzLmxvY2tzTG9zdCsrO1xuICAgICAgICAgICAgICB0aGF0Ll9jb25maWcuZGVidWdFbmFibGVkID8/IGNvbnNvbGUuZGVidWcoJ0Zhc3RNdXRleCBjbGllbnQgXCIlc1wiIGxvc3QgdGhlIGxvY2sgY29udGVudGlvbiBvbiBcIiVzXCIgdG8gYW5vdGhlciBwcm9jZXNzICglcykuIFJlc3RhcnRpbmcuLi4nLCB0aGF0Ll9jbGllbnRJZCwga2V5LCBsc1kpO1xuICAgICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYWNxdWlyZUxvY2soa2V5KTtcbiAgICAgICAgICAgICAgfSwgMTApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sIDEwMCk7XG5cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBubyBjb250ZW50aW9uOlxuICAgICAgICB0aGF0Ll9jb25maWcuZGVidWdFbmFibGVkID8/IGNvbnNvbGUuZGVidWcoJ0Zhc3RNdXRleCBjbGllbnQgXCIlc1wiIGFjcXVpcmVkIGEgbG9jayBvbiBcIiVzXCIgd2l0aCBubyBjb250ZW50aW9uJywgdGhhdC5fY2xpZW50SWQsIGtleSk7XG4gICAgICAgIHRoYXQucmVzb2x2ZVdpdGhTdGF0cyhzdWJzY3JpYmVyLCBsb2NrU3RhdHMpO1xuICAgICAgfTtcblxuICAgICAgYWNxdWlyZUxvY2soa2V5KTtcblxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIHJlbGVhc2Uoa2V5KSB7XG4gICAgdGhpcy5fY29uZmlnLmRlYnVnRW5hYmxlZCA/PyBjb25zb2xlLmRlYnVnKCdGYXN0TXV0ZXggY2xpZW50IFwiJXNcIiBpcyByZWxlYXNpbmcgbG9jayBvbiBcIiVzXCInLCB0aGlzLl9jbGllbnRJZCwga2V5KTtcblxuICAgIGxldCB4ID0gdGhpcy5feFByZWZpeCArIGtleTtcbiAgICBsZXQgeSA9IHRoaXMuX3lQcmVmaXggKyBrZXk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oeCk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oeSk7XG5cbiAgICAvL3RoYXQubG9ja1N0YXRzLmxvY2tFbmQgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICAvL3RoYXQubG9ja1N0YXRzLmxvY2tEdXJhdGlvbiA9IHRoYXQubG9ja1N0YXRzLmxvY2tFbmQgLSB0aGF0LmxvY2tTdGF0cy5sb2NrU3RhcnQ7XG5cbiAgICAvL2xldCByZXRTdGF0cyA9IGFuZ3VsYXIuY29weSh0aGF0LmxvY2tTdGF0cyk7XG5cbiAgICAvL3RoYXQucmVzZXRTdGF0cygpO1xuXG4gICAgLy9yZXR1cm4gcmV0U3RhdHM7XG4gIH1cblxuICBwcml2YXRlIF9nZW5lcmF0ZVJhbmRvbUlkKCkge1xuICAgIHJldHVybiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMDAwMDAwMDAwMCkgKyAnJztcbiAgfVxuXG4gIHByaXZhdGUgcmVzZXRTdGF0cyhsb2NrU3RhdHM6IE11dGV4TG9ja1N0YXRzKSB7XG4gICAgbG9ja1N0YXRzLnJlc3RhcnRDb3VudCA9IDA7XG4gICAgbG9ja1N0YXRzLmxvY2tzTG9zdCA9IDA7XG4gICAgbG9ja1N0YXRzLmNvbnRlbnRpb25Db3VudCA9IDA7XG4gICAgbG9ja1N0YXRzLmFjcXVpcmVEdXJhdGlvbiA9IDA7XG4gICAgbG9ja1N0YXRzLmFjcXVpcmVTdGFydCA9IG51bGw7XG4gIH1cblxuICBwcml2YXRlIHJlc29sdmVXaXRoU3RhdHMoc3Vic2NyaWJlcjogU3Vic2NyaWJlcjxNdXRleExvY2tTdGF0cz4sIHN0YXRzOiBNdXRleExvY2tTdGF0cykge1xuICAgIHZhciBjdXJyZW50VGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgIHN0YXRzLmFjcXVpcmVFbmQgPSBjdXJyZW50VGltZTtcbiAgICBzdGF0cy5hY3F1aXJlRHVyYXRpb24gPSBzdGF0cy5hY3F1aXJlRW5kIC0gc3RhdHMuYWNxdWlyZVN0YXJ0O1xuICAgIHN0YXRzLmxvY2tTdGFydCA9IGN1cnJlbnRUaW1lO1xuICAgIHN1YnNjcmliZXIubmV4dChzdGF0cyk7XG4gICAgc3Vic2NyaWJlci5jb21wbGV0ZSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEhlbHBlciBmdW5jdGlvbiB0byB3cmFwIGFsbCB2YWx1ZXMgaW4gYW4gb2JqZWN0IHRoYXQgaW5jbHVkZXMgdGhlIHRpbWUgKHNvXG4gICAqIHRoYXQgd2UgY2FuIGV4cGlyZSBpdCBpbiB0aGUgZnV0dXJlKSBhbmQganNvbi5zdHJpbmdpZnkncyBpdFxuICAgKi9cbiAgcHJpdmF0ZSBfc2V0SXRlbShrZXksIGNsaWVudElkLCB0aW1lb3V0KSB7XG4gICAgbGV0IGxvY2tJdGVtID0gbmV3IExvY2tJdGVtKCk7XG4gICAgbG9ja0l0ZW0uY2xpZW50SWQgPSBjbGllbnRJZDtcbiAgICBsb2NrSXRlbS5leHBpcmVzQXQgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSArIHRpbWVvdXQ7XG4gICAgcmV0dXJuIGxvY2FsU3RvcmFnZS5zZXRJdGVtKGtleSwgSlNPTi5zdHJpbmdpZnkobG9ja0l0ZW0pKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBIZWxwZXIgZnVuY3Rpb24gdG8gcGFyc2UgSlNPTiBlbmNvZGVkIHZhbHVlcyBzZXQgaW4gbG9jYWxTdG9yYWdlXG4gICAqL1xuICBwcml2YXRlIF9nZXRJdGVtKGtleSwgdGltZW91dCkge1xuICAgIHZhciBpdGVtID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oa2V5KTtcblxuICAgIGlmICghaXRlbSkgcmV0dXJuIG51bGw7XG5cbiAgICB2YXIgbG9ja0l0ZW0gPSA8TG9ja0l0ZW0+SlNPTi5wYXJzZShpdGVtKTtcbiAgICBpZiAobmV3IERhdGUoKS5nZXRUaW1lKCkgLSBsb2NrSXRlbS5leHBpcmVzQXQgPj0gdGltZW91dCkge1xuICAgICAgdGhpcy5fY29uZmlnLmRlYnVnRW5hYmxlZCA/PyBjb25zb2xlLmRlYnVnKCdGYXN0TXV0ZXggY2xpZW50IFwiJXNcIiByZW1vdmVkIGFuIGV4cGlyZWQgcmVjb3JkIG9uIFwiJXNcIicsIHRoaXMuX2NsaWVudElkLCBrZXkpO1xuICAgICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oa2V5KTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiBsb2NrSXRlbS5jbGllbnRJZDtcbiAgfVxuXG4gIHByaXZhdGUgX3JlbGVhc2VFeHBpcmVkTG9jayhrZXk6IHN0cmluZyl7XG4gICAgdmFyIGl0ZW0gPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShrZXkpO1xuXG4gICAgaWYgKCFpdGVtKSByZXR1cm4gbnVsbDtcblxuICAgIHZhciBsb2NrSXRlbSA9IDxMb2NrSXRlbT5KU09OLnBhcnNlKGl0ZW0pO1xuXG4gICAgaWYgKGxvY2tJdGVtLmV4cGlyZXNBdCA8PSBuZXcgRGF0ZSgpLmdldFRpbWUoKSkge1xuICAgICAgdGhpcy5fY29uZmlnLmRlYnVnRW5hYmxlZCA/PyBjb25zb2xlLmRlYnVnKCdGYXN0TXV0ZXggYXV0byByZW1vdmVkIGFuIGV4cGlyZWQgcmVjb3JkIG9uIFwiJXNcIicsIGtleSk7XG4gICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShrZXkpO1xuICAgIH1cbiAgfVxufVxuIl19