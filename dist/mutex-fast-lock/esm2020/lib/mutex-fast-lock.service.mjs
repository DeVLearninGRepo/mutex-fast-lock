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
MutexFastLockService.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "15.1.2", ngImport: i0, type: MutexFastLockService, deps: [{ token: MUTEX_FAST_LOCK_CONFIG }], target: i0.ɵɵFactoryTarget.Injectable });
MutexFastLockService.ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "15.1.2", ngImport: i0, type: MutexFastLockService, providedIn: 'root' });
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "15.1.2", ngImport: i0, type: MutexFastLockService, decorators: [{
            type: Injectable,
            args: [{
                    providedIn: 'root'
                }]
        }], ctorParameters: function () { return [{ type: i1.MutexFastLockConfig, decorators: [{
                    type: Inject,
                    args: [MUTEX_FAST_LOCK_CONFIG]
                }] }]; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXV0ZXgtZmFzdC1sb2NrLnNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9wcm9qZWN0cy9tdXRleC1mYXN0LWxvY2svc3JjL2xpYi9tdXRleC1mYXN0LWxvY2suc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUNuRCxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUUzRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDM0QsT0FBTyxFQUFFLFVBQVUsRUFBYyxNQUFNLE1BQU0sQ0FBQztBQUM5QyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7OztBQUs5QyxNQUFNLE9BQU8sb0JBQW9CO0lBTS9CLFlBQ21ELE9BQTRCO1FBQTVCLFlBQU8sR0FBUCxPQUFPLENBQXFCO1FBRTdFLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFDMUMsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztRQUMzQyxJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQyxVQUFVLEdBQUcsS0FBSyxDQUFDO1FBRTNDLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQztRQUNoQixNQUFNLENBQUMsZ0JBQWdCLENBQUMsY0FBYyxFQUFFLFVBQVUsRUFBRTtZQUNsRCxJQUFJLEdBQUcsR0FBRyxFQUFFLENBQUM7WUFFYixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsWUFBWSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFDNUMsSUFBSSxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElB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QztRQUMxQyxJQUFJLElBQUksSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFLEdBQUcsUUFBUSxDQUFDLFNBQVMsSUFBSSxPQUFPLEVBQUU7WUFDeEQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyx5REFBeUQsRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQzNILFlBQVksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDN0IsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUVELE9BQU8sUUFBUSxDQUFDLFFBQVEsQ0FBQztJQUMzQixDQUFDO0lBRU8sbUJBQW1CLENBQUMsR0FBVztRQUNyQyxJQUFJLElBQUksR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRXJDLElBQUksQ0FBQyxJQUFJO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFFdkIsSUFBSSxRQUFRLEdBQWEsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUUxQyxJQUFJLFFBQVEsQ0FBQyxTQUFTLElBQUksSUFBSSxJQUFJLEVBQUUsQ0FBQyxPQUFPLEVBQUUsRUFBRTtZQUM5QyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLGtEQUFrRCxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQ3BHLFlBQVksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7U0FDOUI7SUFDSCxDQUFDOztpSEFuTVUsb0JBQW9CLGtCQU9yQixzQkFBc0I7cUhBUHJCLG9CQUFvQixjQUZuQixNQUFNOzJGQUVQLG9CQUFvQjtrQkFIaEMsVUFBVTttQkFBQztvQkFDVixVQUFVLEVBQUUsTUFBTTtpQkFDbkI7OzBCQVFJLE1BQU07MkJBQUMsc0JBQXNCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSW5qZWN0LCBJbmplY3RhYmxlIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBNVVRFWF9GQVNUX0xPQ0tfQ09ORklHIH0gZnJvbSAnLi9tdXRleC1mYXN0LWxvY2stY29uZmlnLmluamVjdG9yJztcbmltcG9ydCB7IE11dGV4RmFzdExvY2tDb25maWcgfSBmcm9tICcuL21vZGVscy9tdXRleC1mYXN0LWxvY2stY29uZmlnJztcbmltcG9ydCB7IE11dGV4TG9ja1N0YXRzIH0gZnJvbSAnLi9tb2RlbHMvbXV0ZXgtbG9jay1zdGF0cyc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBTdWJzY3JpYmVyIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBMb2NrSXRlbSB9IGZyb20gJy4vbW9kZWxzL2xvY2staXRlbSc7XG5cbkBJbmplY3RhYmxlKHtcbiAgcHJvdmlkZWRJbjogJ3Jvb3QnXG59KVxuZXhwb3J0IGNsYXNzIE11dGV4RmFzdExvY2tTZXJ2aWNlIHtcblxuICBwcml2YXRlIF9jbGllbnRJZDogc3RyaW5nO1xuICBwcml2YXRlIF94UHJlZml4OiBzdHJpbmc7XG4gIHByaXZhdGUgX3lQcmVmaXg6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihcbiAgICBASW5qZWN0KE1VVEVYX0ZBU1RfTE9DS19DT05GSUcpIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZzogTXV0ZXhGYXN0TG9ja0NvbmZpZyxcbiAgKSB7XG4gICAgdGhpcy5fY2xpZW50SWQgPSB0aGlzLl9nZW5lcmF0ZVJhbmRvbUlkKCk7XG4gICAgdGhpcy5feFByZWZpeCA9IF9jb25maWcubG9ja1ByZWZpeCArICdfWF8nO1xuICAgIHRoaXMuX3lQcmVmaXggPSBfY29uZmlnLmxvY2tQcmVmaXggKyAnX1lfJztcblxuICAgIGxldCB0aGF0ID0gdGhpcztcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImJlZm9yZXVubG9hZFwiLCBmdW5jdGlvbiAoZXYpIHtcbiAgICAgIHZhciBhcnIgPSBbXTtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsb2NhbFN0b3JhZ2UubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGxvY2FsU3RvcmFnZS5rZXkoaSkuaW5kZXhPZih0aGF0Ll94UHJlZml4KSA9PSAwXG4gICAgICAgICAgfHwgbG9jYWxTdG9yYWdlLmtleShpKS5pbmRleE9mKHRoYXQuX3lQcmVmaXgpID09IDApIHtcbiAgICAgICAgICBhcnIucHVzaChsb2NhbFN0b3JhZ2Uua2V5KGkpKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShhcnJbaV0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGxvY2soa2V5OiBzdHJpbmcsIHRpbWVvdXQ6IG51bWJlciA9IC0xKSB7XG4gICAgbGV0IHRoYXQgPSB0aGlzO1xuXG4gICAgaWYgKHRpbWVvdXQgPT0gLTEpIHRpbWVvdXQgPSB0aGlzLl9jb25maWcudGltZW91dDtcblxuICAgIGxldCB4TG9jayA9IHRoYXQuX3hQcmVmaXggKyBrZXk7XG4gICAgbGV0IHlMb2NrID0gdGhhdC5feVByZWZpeCArIGtleTtcblxuICAgIGxldCBsb2NrU3RhdHM6IE11dGV4TG9ja1N0YXRzID0gbmV3IE11dGV4TG9ja1N0YXRzKCk7XG5cbiAgICB0aGF0LnJlc2V0U3RhdHMobG9ja1N0YXRzKTtcblxuICAgIHRoaXMuX2NvbmZpZy5kZWJ1Z0VuYWJsZWQgPz8gY29uc29sZS5kZWJ1ZygnQXR0ZW1wdGluZyB0byBhY3F1aXJlIExvY2sgb24gXCIlc1wiIHVzaW5nIEZhc3RNdXRleCBpbnN0YW5jZSBcIiVzXCInLCBrZXksIHRoaXMuX2NsaWVudElkKTtcblxuICAgIGxvY2tTdGF0cy5hY3F1aXJlU3RhcnQgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcblxuICAgIC8vcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGU8TXV0ZXhMb2NrU3RhdHM+KHN1YnNjcmliZXIgPT4ge1xuICAgICAgLy8gd2UgbmVlZCB0byBkaWZmZXJlbnRpYXRlIGJldHdlZW4gQVBJIGNhbGxzIHRvIGxvY2soKSBhbmQgb3VyIGludGVybmFsXG4gICAgICAvLyByZWN1cnNpdmUgY2FsbHMgc28gdGhhdCB3ZSBjYW4gdGltZW91dCBiYXNlZCBvbiB0aGUgb3JpZ2luYWwgbG9jaygpIGFuZFxuICAgICAgLy8gbm90IGVhY2ggc3Vic2VxdWVudCBjYWxsLiAgVGhlcmVmb3JlLCBjcmVhdGUgYSBuZXcgZnVuY3Rpb24gaGVyZSB3aXRoaW5cbiAgICAgIC8vIHRoZSBwcm9taXNlIGNsb3N1cmUgdGhhdCB3ZSB1c2UgZm9yIHN1YnNlcXVlbnQgY2FsbHM6XG4gICAgICBsZXQgYWNxdWlyZUxvY2sgPSBmdW5jdGlvbiBhY3F1aXJlTG9jayhrZXkpIHtcblxuICAgICAgICB0aGF0Ll9yZWxlYXNlRXhwaXJlZExvY2soeExvY2spO1xuICAgICAgICB0aGF0Ll9yZWxlYXNlRXhwaXJlZExvY2soeUxvY2spO1xuXG4gICAgICAgIHZhciBlbGFwc2VkVGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gbG9ja1N0YXRzLmFjcXVpcmVTdGFydDtcbiAgICAgICAgaWYgKGVsYXBzZWRUaW1lID49IHRpbWVvdXQpIHtcbiAgICAgICAgICB0aGF0Ll9jb25maWcuZGVidWdFbmFibGVkID8/IGNvbnNvbGUuZGVidWcoJ0xvY2sgb24gXCIlc1wiIGNvdWxkIG5vdCBiZSBhY3F1aXJlZCB3aXRoaW4gJXNtcyBieSBGYXN0TXV0ZXggY2xpZW50IFwiJXNcIicsIGtleSwgdGltZW91dCwgdGhhdC5fY2xpZW50SWQpO1xuICAgICAgICAgIHN1YnNjcmliZXIuZXJyb3IobmV3IEVycm9yKCdMb2NrIGNvdWxkIG5vdCBiZSBhY3F1aXJlZCB3aXRoaW4gJyArIHRpbWVvdXQgKyAnbXMnKSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGF0Ll9zZXRJdGVtKHhMb2NrLCB0aGF0Ll9jbGllbnRJZCwgdGltZW91dCk7XG5cbiAgICAgICAgLy8gaWYgeSBleGlzdHMsIGFub3RoZXIgY2xpZW50IGlzIGdldHRpbmcgYSBsb2NrLCBzbyByZXRyeSBpbiBhIGJpdFxuICAgICAgICB2YXIgbHNZID0gdGhhdC5fZ2V0SXRlbSh5TG9jaywgdGltZW91dCk7XG4gICAgICAgIGlmIChsc1kpIHtcbiAgICAgICAgICB0aGF0Ll9jb25maWcuZGVidWdFbmFibGVkID8/IGNvbnNvbGUuZGVidWcoJ0xvY2sgZXhpc3RzIG9uIFkgKCVzKSwgcmVzdGFydGluZy4uLicsIGxzWSk7XG4gICAgICAgICAgbG9ja1N0YXRzLnJlc3RhcnRDb3VudCsrO1xuICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIGFjcXVpcmVMb2NrKGtleSk7XG4gICAgICAgICAgfSwgMTApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFzayBmb3IgaW5uZXIgbG9ja1xuICAgICAgICB0aGF0Ll9zZXRJdGVtKHlMb2NrLCB0aGF0Ll9jbGllbnRJZCwgdGltZW91dCk7XG5cbiAgICAgICAgLy8gaWYgeCB3YXMgY2hhbmdlZCwgYW5vdGhlciBjbGllbnQgaXMgY29udGVuZGluZyBmb3IgYW4gaW5uZXIgbG9ja1xuICAgICAgICB2YXIgbHNYID0gdGhhdC5fZ2V0SXRlbSh4TG9jaywgdGltZW91dCk7XG4gICAgICAgIGlmIChsc1ggIT09IHRoYXQuX2NsaWVudElkKSB7XG4gICAgICAgICAgbG9ja1N0YXRzLmNvbnRlbnRpb25Db3VudCsrO1xuICAgICAgICAgIHRoYXQuX2NvbmZpZy5kZWJ1Z0VuYWJsZWQgPz8gY29uc29sZS5kZWJ1ZygnTG9jayBjb250ZW50aW9uIGRldGVjdGVkLiBYPVwiJXNcIicsIGxzWCk7XG5cbiAgICAgICAgICAvLyBHaXZlIGVub3VnaCB0aW1lIGZvciBjcml0aWNhbCBzZWN0aW9uOlxuICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgbHNZID0gdGhhdC5fZ2V0SXRlbSh5TG9jaywgdGltZW91dCk7XG4gICAgICAgICAgICBpZiAobHNZID09PSB0aGF0Ll9jbGllbnRJZCkge1xuICAgICAgICAgICAgICAvLyB3ZSBoYXZlIGEgbG9ja1xuICAgICAgICAgICAgICB0aGF0Ll9jb25maWcuZGVidWdFbmFibGVkID8/IGNvbnNvbGUuZGVidWcoJ0Zhc3RNdXRleCBjbGllbnQgXCIlc1wiIHdvbiB0aGUgbG9jayBjb250ZW50aW9uIG9uIFwiJXNcIicsIHRoYXQuX2NsaWVudElkLCBrZXkpO1xuICAgICAgICAgICAgICB0aGF0LnJlc29sdmVXaXRoU3RhdHMoc3Vic2NyaWJlciwgbG9ja1N0YXRzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIHdlIGxvc3QgdGhlIGxvY2ssIHJlc3RhcnQgdGhlIHByb2Nlc3MgYWdhaW5cbiAgICAgICAgICAgICAgbG9ja1N0YXRzLnJlc3RhcnRDb3VudCsrO1xuICAgICAgICAgICAgICBsb2NrU3RhdHMubG9ja3NMb3N0Kys7XG4gICAgICAgICAgICAgIHRoYXQuX2NvbmZpZy5kZWJ1Z0VuYWJsZWQgPz8gY29uc29sZS5kZWJ1ZygnRmFzdE11dGV4IGNsaWVudCBcIiVzXCIgbG9zdCB0aGUgbG9jayBjb250ZW50aW9uIG9uIFwiJXNcIiB0byBhbm90aGVyIHByb2Nlc3MgKCVzKS4gUmVzdGFydGluZy4uLicsIHRoYXQuX2NsaWVudElkLCBrZXksIGxzWSk7XG4gICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBhY3F1aXJlTG9jayhrZXkpO1xuICAgICAgICAgICAgICB9LCAxMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSwgMTAwKTtcblxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG5vIGNvbnRlbnRpb246XG4gICAgICAgIHRoYXQuX2NvbmZpZy5kZWJ1Z0VuYWJsZWQgPz8gY29uc29sZS5kZWJ1ZygnRmFzdE11dGV4IGNsaWVudCBcIiVzXCIgYWNxdWlyZWQgYSBsb2NrIG9uIFwiJXNcIiB3aXRoIG5vIGNvbnRlbnRpb24nLCB0aGF0Ll9jbGllbnRJZCwga2V5KTtcbiAgICAgICAgdGhhdC5yZXNvbHZlV2l0aFN0YXRzKHN1YnNjcmliZXIsIGxvY2tTdGF0cyk7XG4gICAgICB9O1xuXG4gICAgICBhY3F1aXJlTG9jayhrZXkpO1xuXG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgcmVsZWFzZShrZXkpIHtcbiAgICB0aGlzLl9jb25maWcuZGVidWdFbmFibGVkID8/IGNvbnNvbGUuZGVidWcoJ0Zhc3RNdXRleCBjbGllbnQgXCIlc1wiIGlzIHJlbGVhc2luZyBsb2NrIG9uIFwiJXNcIicsIHRoaXMuX2NsaWVudElkLCBrZXkpO1xuXG4gICAgbGV0IHggPSB0aGlzLl94UHJlZml4ICsga2V5O1xuICAgIGxldCB5ID0gdGhpcy5feVByZWZpeCArIGtleTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSh4KTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSh5KTtcblxuICAgIC8vdGhhdC5sb2NrU3RhdHMubG9ja0VuZCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgIC8vdGhhdC5sb2NrU3RhdHMubG9ja0R1cmF0aW9uID0gdGhhdC5sb2NrU3RhdHMubG9ja0VuZCAtIHRoYXQubG9ja1N0YXRzLmxvY2tTdGFydDtcblxuICAgIC8vbGV0IHJldFN0YXRzID0gYW5ndWxhci5jb3B5KHRoYXQubG9ja1N0YXRzKTtcblxuICAgIC8vdGhhdC5yZXNldFN0YXRzKCk7XG5cbiAgICAvL3JldHVybiByZXRTdGF0cztcbiAgfVxuXG4gIHByaXZhdGUgX2dlbmVyYXRlUmFuZG9tSWQoKSB7XG4gICAgcmV0dXJuIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwMDAwMDAwKSArICcnO1xuICB9XG5cbiAgcHJpdmF0ZSByZXNldFN0YXRzKGxvY2tTdGF0czogTXV0ZXhMb2NrU3RhdHMpIHtcbiAgICBsb2NrU3RhdHMucmVzdGFydENvdW50ID0gMDtcbiAgICBsb2NrU3RhdHMubG9ja3NMb3N0ID0gMDtcbiAgICBsb2NrU3RhdHMuY29udGVudGlvbkNvdW50ID0gMDtcbiAgICBsb2NrU3RhdHMuYWNxdWlyZUR1cmF0aW9uID0gMDtcbiAgICBsb2NrU3RhdHMuYWNxdWlyZVN0YXJ0ID0gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgcmVzb2x2ZVdpdGhTdGF0cyhzdWJzY3JpYmVyOiBTdWJzY3JpYmVyPE11dGV4TG9ja1N0YXRzPiwgc3RhdHM6IE11dGV4TG9ja1N0YXRzKSB7XG4gICAgdmFyIGN1cnJlbnRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgc3RhdHMuYWNxdWlyZUVuZCA9IGN1cnJlbnRUaW1lO1xuICAgIHN0YXRzLmFjcXVpcmVEdXJhdGlvbiA9IHN0YXRzLmFjcXVpcmVFbmQgLSBzdGF0cy5hY3F1aXJlU3RhcnQ7XG4gICAgc3RhdHMubG9ja1N0YXJ0ID0gY3VycmVudFRpbWU7XG4gICAgc3Vic2NyaWJlci5uZXh0KHN0YXRzKTtcbiAgICBzdWJzY3JpYmVyLmNvbXBsZXRlKCk7XG4gIH1cblxuICAvKipcbiAgICogSGVscGVyIGZ1bmN0aW9uIHRvIHdyYXAgYWxsIHZhbHVlcyBpbiBhbiBvYmplY3QgdGhhdCBpbmNsdWRlcyB0aGUgdGltZSAoc29cbiAgICogdGhhdCB3ZSBjYW4gZXhwaXJlIGl0IGluIHRoZSBmdXR1cmUpIGFuZCBqc29uLnN0cmluZ2lmeSdzIGl0XG4gICAqL1xuICBwcml2YXRlIF9zZXRJdGVtKGtleSwgY2xpZW50SWQsIHRpbWVvdXQpIHtcbiAgICBsZXQgbG9ja0l0ZW0gPSBuZXcgTG9ja0l0ZW0oKTtcbiAgICBsb2NrSXRlbS5jbGllbnRJZCA9IGNsaWVudElkO1xuICAgIGxvY2tJdGVtLmV4cGlyZXNBdCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpICsgdGltZW91dDtcbiAgICByZXR1cm4gbG9jYWxTdG9yYWdlLnNldEl0ZW0oa2V5LCBKU09OLnN0cmluZ2lmeShsb2NrSXRlbSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEhlbHBlciBmdW5jdGlvbiB0byBwYXJzZSBKU09OIGVuY29kZWQgdmFsdWVzIHNldCBpbiBsb2NhbFN0b3JhZ2VcbiAgICovXG4gIHByaXZhdGUgX2dldEl0ZW0oa2V5LCB0aW1lb3V0KSB7XG4gICAgdmFyIGl0ZW0gPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShrZXkpO1xuXG4gICAgaWYgKCFpdGVtKSByZXR1cm4gbnVsbDtcblxuICAgIHZhciBsb2NrSXRlbSA9IDxMb2NrSXRlbT5KU09OLnBhcnNlKGl0ZW0pO1xuICAgIGlmIChuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIGxvY2tJdGVtLmV4cGlyZXNBdCA+PSB0aW1lb3V0KSB7XG4gICAgICB0aGlzLl9jb25maWcuZGVidWdFbmFibGVkID8/IGNvbnNvbGUuZGVidWcoJ0Zhc3RNdXRleCBjbGllbnQgXCIlc1wiIHJlbW92ZWQgYW4gZXhwaXJlZCByZWNvcmQgb24gXCIlc1wiJywgdGhpcy5fY2xpZW50SWQsIGtleSk7XG4gICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShrZXkpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIGxvY2tJdGVtLmNsaWVudElkO1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVsZWFzZUV4cGlyZWRMb2NrKGtleTogc3RyaW5nKXtcbiAgICB2YXIgaXRlbSA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKGtleSk7XG5cbiAgICBpZiAoIWl0ZW0pIHJldHVybiBudWxsO1xuXG4gICAgdmFyIGxvY2tJdGVtID0gPExvY2tJdGVtPkpTT04ucGFyc2UoaXRlbSk7XG5cbiAgICBpZiAobG9ja0l0ZW0uZXhwaXJlc0F0IDw9IG5ldyBEYXRlKCkuZ2V0VGltZSgpKSB7XG4gICAgICB0aGlzLl9jb25maWcuZGVidWdFbmFibGVkID8/IGNvbnNvbGUuZGVidWcoJ0Zhc3RNdXRleCBhdXRvIHJlbW92ZWQgYW4gZXhwaXJlZCByZWNvcmQgb24gXCIlc1wiJywga2V5KTtcbiAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKGtleSk7XG4gICAgfVxuICB9XG59XG4iXX0=