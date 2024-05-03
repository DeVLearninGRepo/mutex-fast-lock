import { Inject, Injectable } from '@angular/core';
import { MUTEX_FAST_LOCK_CONFIG } from './mutex-fast-lock-config.injector';
import { MutexLockStats } from './models/mutex-lock-stats';
import { Observable } from 'rxjs';
import { LockItem } from './models/lock-item';
import * as i0 from "@angular/core";
import * as i1 from "./models/mutex-fast-lock-config";
export class MutexFastLockService {
    _config;
    _clientId;
    _xPrefix;
    _yPrefix;
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
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.7", ngImport: i0, type: MutexFastLockService, deps: [{ token: MUTEX_FAST_LOCK_CONFIG }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "17.3.7", ngImport: i0, type: MutexFastLockService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.7", ngImport: i0, type: MutexFastLockService, decorators: [{
            type: Injectable,
            args: [{
                    providedIn: 'root'
                }]
        }], ctorParameters: () => [{ type: i1.MutexFastLockConfig, decorators: [{
                    type: Inject,
                    args: [MUTEX_FAST_LOCK_CONFIG]
                }] }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXV0ZXgtZmFzdC1sb2NrLnNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9wcm9qZWN0cy9tdXRleC1mYXN0LWxvY2svc3JjL2xpYi9tdXRleC1mYXN0LWxvY2suc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUNuRCxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUUzRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDM0QsT0FBTyxFQUFFLFVBQVUsRUFBYyxNQUFNLE1BQU0sQ0FBQztBQUM5QyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7OztBQUs5QyxNQUFNLE9BQU8sb0JBQW9CO0lBT29CO0lBTDNDLFNBQVMsQ0FBUztJQUNsQixRQUFRLENBQVM7SUFDakIsUUFBUSxDQUFTO0lBRXpCLFlBQ21ELE9BQTRCO1FBQTVCLFlBQU8sR0FBUCxPQUFPLENBQXFCO1FBRTdFLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFDMUMsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztRQUMzQyxJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQyxVQUFVLEdBQUcsS0FBSyxDQUFDO1FBRTNDLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQztRQUNoQixNQUFNLENBQUMsZ0JBQWdCLENBQUMsY0FBYyxFQUFFLFVBQVUsRUFBRTtZQUNsRCxJQUFJLEdBQUcsR0FBRyxFQUFFLENBQUM7WUFFYixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsWUFBWSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUM3QyxJQUFJLFlBQVksQ0FB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QVU7bUJBQUM7b0JBQ1YsVUFBVSxFQUFFLE1BQU07aUJBQ25COzswQkFRSSxNQUFNOzJCQUFDLHNCQUFzQiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEluamVjdCwgSW5qZWN0YWJsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xyXG5pbXBvcnQgeyBNVVRFWF9GQVNUX0xPQ0tfQ09ORklHIH0gZnJvbSAnLi9tdXRleC1mYXN0LWxvY2stY29uZmlnLmluamVjdG9yJztcclxuaW1wb3J0IHsgTXV0ZXhGYXN0TG9ja0NvbmZpZyB9IGZyb20gJy4vbW9kZWxzL211dGV4LWZhc3QtbG9jay1jb25maWcnO1xyXG5pbXBvcnQgeyBNdXRleExvY2tTdGF0cyB9IGZyb20gJy4vbW9kZWxzL211dGV4LWxvY2stc3RhdHMnO1xyXG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBTdWJzY3JpYmVyIH0gZnJvbSAncnhqcyc7XHJcbmltcG9ydCB7IExvY2tJdGVtIH0gZnJvbSAnLi9tb2RlbHMvbG9jay1pdGVtJztcclxuXHJcbkBJbmplY3RhYmxlKHtcclxuICBwcm92aWRlZEluOiAncm9vdCdcclxufSlcclxuZXhwb3J0IGNsYXNzIE11dGV4RmFzdExvY2tTZXJ2aWNlIHtcclxuXHJcbiAgcHJpdmF0ZSBfY2xpZW50SWQ6IHN0cmluZztcclxuICBwcml2YXRlIF94UHJlZml4OiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBfeVByZWZpeDogc3RyaW5nO1xyXG5cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIEBJbmplY3QoTVVURVhfRkFTVF9MT0NLX0NPTkZJRykgcHJpdmF0ZSByZWFkb25seSBfY29uZmlnOiBNdXRleEZhc3RMb2NrQ29uZmlnLFxyXG4gICkge1xyXG4gICAgdGhpcy5fY2xpZW50SWQgPSB0aGlzLl9nZW5lcmF0ZVJhbmRvbUlkKCk7XHJcbiAgICB0aGlzLl94UHJlZml4ID0gX2NvbmZpZy5sb2NrUHJlZml4ICsgJ19YXyc7XHJcbiAgICB0aGlzLl95UHJlZml4ID0gX2NvbmZpZy5sb2NrUHJlZml4ICsgJ19ZXyc7XHJcblxyXG4gICAgbGV0IHRoYXQgPSB0aGlzO1xyXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJiZWZvcmV1bmxvYWRcIiwgZnVuY3Rpb24gKGV2KSB7XHJcbiAgICAgIHZhciBhcnIgPSBbXTtcclxuXHJcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbG9jYWxTdG9yYWdlLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgaWYgKGxvY2FsU3RvcmFnZS5rZXkoaSkuaW5kZXhPZih0aGF0Ll94UHJlZml4KSA9PSAwXHJcbiAgICAgICAgICB8fCBsb2NhbFN0b3JhZ2Uua2V5KGkpLmluZGV4T2YodGhhdC5feVByZWZpeCkgPT0gMCkge1xyXG4gICAgICAgICAgYXJyLnB1c2gobG9jYWxTdG9yYWdlLmtleShpKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKGFycltpXSk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGxvY2soa2V5OiBzdHJpbmcsIHRpbWVvdXQ6IG51bWJlciA9IC0xKSB7XHJcbiAgICBsZXQgdGhhdCA9IHRoaXM7XHJcblxyXG4gICAgaWYgKHRpbWVvdXQgPT0gLTEpIHRpbWVvdXQgPSB0aGlzLl9jb25maWcudGltZW91dDtcclxuXHJcbiAgICBsZXQgeExvY2sgPSB0aGF0Ll94UHJlZml4ICsga2V5O1xyXG4gICAgbGV0IHlMb2NrID0gdGhhdC5feVByZWZpeCArIGtleTtcclxuXHJcbiAgICBsZXQgbG9ja1N0YXRzOiBNdXRleExvY2tTdGF0cyA9IG5ldyBNdXRleExvY2tTdGF0cygpO1xyXG5cclxuICAgIHRoYXQucmVzZXRTdGF0cyhsb2NrU3RhdHMpO1xyXG5cclxuICAgIHRoaXMuX2NvbmZpZy5kZWJ1Z0VuYWJsZWQgPz8gY29uc29sZS5kZWJ1ZygnQXR0ZW1wdGluZyB0byBhY3F1aXJlIExvY2sgb24gXCIlc1wiIHVzaW5nIEZhc3RNdXRleCBpbnN0YW5jZSBcIiVzXCInLCBrZXksIHRoaXMuX2NsaWVudElkKTtcclxuXHJcbiAgICBsb2NrU3RhdHMuYWNxdWlyZVN0YXJ0ID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XHJcblxyXG4gICAgLy9yZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlPE11dGV4TG9ja1N0YXRzPihzdWJzY3JpYmVyID0+IHtcclxuICAgICAgLy8gd2UgbmVlZCB0byBkaWZmZXJlbnRpYXRlIGJldHdlZW4gQVBJIGNhbGxzIHRvIGxvY2soKSBhbmQgb3VyIGludGVybmFsXHJcbiAgICAgIC8vIHJlY3Vyc2l2ZSBjYWxscyBzbyB0aGF0IHdlIGNhbiB0aW1lb3V0IGJhc2VkIG9uIHRoZSBvcmlnaW5hbCBsb2NrKCkgYW5kXHJcbiAgICAgIC8vIG5vdCBlYWNoIHN1YnNlcXVlbnQgY2FsbC4gIFRoZXJlZm9yZSwgY3JlYXRlIGEgbmV3IGZ1bmN0aW9uIGhlcmUgd2l0aGluXHJcbiAgICAgIC8vIHRoZSBwcm9taXNlIGNsb3N1cmUgdGhhdCB3ZSB1c2UgZm9yIHN1YnNlcXVlbnQgY2FsbHM6XHJcbiAgICAgIGxldCBhY3F1aXJlTG9jayA9IGZ1bmN0aW9uIGFjcXVpcmVMb2NrKGtleSkge1xyXG5cclxuICAgICAgICB0aGF0Ll9yZWxlYXNlRXhwaXJlZExvY2soeExvY2spO1xyXG4gICAgICAgIHRoYXQuX3JlbGVhc2VFeHBpcmVkTG9jayh5TG9jayk7XHJcblxyXG4gICAgICAgIHZhciBlbGFwc2VkVGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gbG9ja1N0YXRzLmFjcXVpcmVTdGFydDtcclxuICAgICAgICBpZiAoZWxhcHNlZFRpbWUgPj0gdGltZW91dCkge1xyXG4gICAgICAgICAgdGhhdC5fY29uZmlnLmRlYnVnRW5hYmxlZCA/PyBjb25zb2xlLmRlYnVnKCdMb2NrIG9uIFwiJXNcIiBjb3VsZCBub3QgYmUgYWNxdWlyZWQgd2l0aGluICVzbXMgYnkgRmFzdE11dGV4IGNsaWVudCBcIiVzXCInLCBrZXksIHRpbWVvdXQsIHRoYXQuX2NsaWVudElkKTtcclxuICAgICAgICAgIHN1YnNjcmliZXIuZXJyb3IobmV3IEVycm9yKCdMb2NrIGNvdWxkIG5vdCBiZSBhY3F1aXJlZCB3aXRoaW4gJyArIHRpbWVvdXQgKyAnbXMnKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGF0Ll9zZXRJdGVtKHhMb2NrLCB0aGF0Ll9jbGllbnRJZCwgdGltZW91dCk7XHJcblxyXG4gICAgICAgIC8vIGlmIHkgZXhpc3RzLCBhbm90aGVyIGNsaWVudCBpcyBnZXR0aW5nIGEgbG9jaywgc28gcmV0cnkgaW4gYSBiaXRcclxuICAgICAgICB2YXIgbHNZID0gdGhhdC5fZ2V0SXRlbSh5TG9jaywgdGltZW91dCk7XHJcbiAgICAgICAgaWYgKGxzWSkge1xyXG4gICAgICAgICAgdGhhdC5fY29uZmlnLmRlYnVnRW5hYmxlZCA/PyBjb25zb2xlLmRlYnVnKCdMb2NrIGV4aXN0cyBvbiBZICglcyksIHJlc3RhcnRpbmcuLi4nLCBsc1kpO1xyXG4gICAgICAgICAgbG9ja1N0YXRzLnJlc3RhcnRDb3VudCsrO1xyXG4gICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBhY3F1aXJlTG9jayhrZXkpO1xyXG4gICAgICAgICAgfSwgMTApO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gYXNrIGZvciBpbm5lciBsb2NrXHJcbiAgICAgICAgdGhhdC5fc2V0SXRlbSh5TG9jaywgdGhhdC5fY2xpZW50SWQsIHRpbWVvdXQpO1xyXG5cclxuICAgICAgICAvLyBpZiB4IHdhcyBjaGFuZ2VkLCBhbm90aGVyIGNsaWVudCBpcyBjb250ZW5kaW5nIGZvciBhbiBpbm5lciBsb2NrXHJcbiAgICAgICAgdmFyIGxzWCA9IHRoYXQuX2dldEl0ZW0oeExvY2ssIHRpbWVvdXQpO1xyXG4gICAgICAgIGlmIChsc1ggIT09IHRoYXQuX2NsaWVudElkKSB7XHJcbiAgICAgICAgICBsb2NrU3RhdHMuY29udGVudGlvbkNvdW50Kys7XHJcbiAgICAgICAgICB0aGF0Ll9jb25maWcuZGVidWdFbmFibGVkID8/IGNvbnNvbGUuZGVidWcoJ0xvY2sgY29udGVudGlvbiBkZXRlY3RlZC4gWD1cIiVzXCInLCBsc1gpO1xyXG5cclxuICAgICAgICAgIC8vIEdpdmUgZW5vdWdoIHRpbWUgZm9yIGNyaXRpY2FsIHNlY3Rpb246XHJcbiAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgbHNZID0gdGhhdC5fZ2V0SXRlbSh5TG9jaywgdGltZW91dCk7XHJcbiAgICAgICAgICAgIGlmIChsc1kgPT09IHRoYXQuX2NsaWVudElkKSB7XHJcbiAgICAgICAgICAgICAgLy8gd2UgaGF2ZSBhIGxvY2tcclxuICAgICAgICAgICAgICB0aGF0Ll9jb25maWcuZGVidWdFbmFibGVkID8/IGNvbnNvbGUuZGVidWcoJ0Zhc3RNdXRleCBjbGllbnQgXCIlc1wiIHdvbiB0aGUgbG9jayBjb250ZW50aW9uIG9uIFwiJXNcIicsIHRoYXQuX2NsaWVudElkLCBrZXkpO1xyXG4gICAgICAgICAgICAgIHRoYXQucmVzb2x2ZVdpdGhTdGF0cyhzdWJzY3JpYmVyLCBsb2NrU3RhdHMpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgIC8vIHdlIGxvc3QgdGhlIGxvY2ssIHJlc3RhcnQgdGhlIHByb2Nlc3MgYWdhaW5cclxuICAgICAgICAgICAgICBsb2NrU3RhdHMucmVzdGFydENvdW50Kys7XHJcbiAgICAgICAgICAgICAgbG9ja1N0YXRzLmxvY2tzTG9zdCsrO1xyXG4gICAgICAgICAgICAgIHRoYXQuX2NvbmZpZy5kZWJ1Z0VuYWJsZWQgPz8gY29uc29sZS5kZWJ1ZygnRmFzdE11dGV4IGNsaWVudCBcIiVzXCIgbG9zdCB0aGUgbG9jayBjb250ZW50aW9uIG9uIFwiJXNcIiB0byBhbm90aGVyIHByb2Nlc3MgKCVzKS4gUmVzdGFydGluZy4uLicsIHRoYXQuX2NsaWVudElkLCBrZXksIGxzWSk7XHJcbiAgICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYWNxdWlyZUxvY2soa2V5KTtcclxuICAgICAgICAgICAgICB9LCAxMCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0sIDEwMCk7XHJcblxyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gbm8gY29udGVudGlvbjpcclxuICAgICAgICB0aGF0Ll9jb25maWcuZGVidWdFbmFibGVkID8/IGNvbnNvbGUuZGVidWcoJ0Zhc3RNdXRleCBjbGllbnQgXCIlc1wiIGFjcXVpcmVkIGEgbG9jayBvbiBcIiVzXCIgd2l0aCBubyBjb250ZW50aW9uJywgdGhhdC5fY2xpZW50SWQsIGtleSk7XHJcbiAgICAgICAgdGhhdC5yZXNvbHZlV2l0aFN0YXRzKHN1YnNjcmliZXIsIGxvY2tTdGF0cyk7XHJcbiAgICAgIH07XHJcblxyXG4gICAgICBhY3F1aXJlTG9jayhrZXkpO1xyXG5cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHJlbGVhc2Uoa2V5KSB7XHJcbiAgICB0aGlzLl9jb25maWcuZGVidWdFbmFibGVkID8/IGNvbnNvbGUuZGVidWcoJ0Zhc3RNdXRleCBjbGllbnQgXCIlc1wiIGlzIHJlbGVhc2luZyBsb2NrIG9uIFwiJXNcIicsIHRoaXMuX2NsaWVudElkLCBrZXkpO1xyXG5cclxuICAgIGxldCB4ID0gdGhpcy5feFByZWZpeCArIGtleTtcclxuICAgIGxldCB5ID0gdGhpcy5feVByZWZpeCArIGtleTtcclxuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKHgpO1xyXG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oeSk7XHJcblxyXG4gICAgLy90aGF0LmxvY2tTdGF0cy5sb2NrRW5kID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XHJcbiAgICAvL3RoYXQubG9ja1N0YXRzLmxvY2tEdXJhdGlvbiA9IHRoYXQubG9ja1N0YXRzLmxvY2tFbmQgLSB0aGF0LmxvY2tTdGF0cy5sb2NrU3RhcnQ7XHJcblxyXG4gICAgLy9sZXQgcmV0U3RhdHMgPSBhbmd1bGFyLmNvcHkodGhhdC5sb2NrU3RhdHMpO1xyXG5cclxuICAgIC8vdGhhdC5yZXNldFN0YXRzKCk7XHJcblxyXG4gICAgLy9yZXR1cm4gcmV0U3RhdHM7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIF9nZW5lcmF0ZVJhbmRvbUlkKCkge1xyXG4gICAgcmV0dXJuIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwMDAwMDAwKSArICcnO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZXNldFN0YXRzKGxvY2tTdGF0czogTXV0ZXhMb2NrU3RhdHMpIHtcclxuICAgIGxvY2tTdGF0cy5yZXN0YXJ0Q291bnQgPSAwO1xyXG4gICAgbG9ja1N0YXRzLmxvY2tzTG9zdCA9IDA7XHJcbiAgICBsb2NrU3RhdHMuY29udGVudGlvbkNvdW50ID0gMDtcclxuICAgIGxvY2tTdGF0cy5hY3F1aXJlRHVyYXRpb24gPSAwO1xyXG4gICAgbG9ja1N0YXRzLmFjcXVpcmVTdGFydCA9IG51bGw7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlc29sdmVXaXRoU3RhdHMoc3Vic2NyaWJlcjogU3Vic2NyaWJlcjxNdXRleExvY2tTdGF0cz4sIHN0YXRzOiBNdXRleExvY2tTdGF0cykge1xyXG4gICAgdmFyIGN1cnJlbnRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XHJcbiAgICBzdGF0cy5hY3F1aXJlRW5kID0gY3VycmVudFRpbWU7XHJcbiAgICBzdGF0cy5hY3F1aXJlRHVyYXRpb24gPSBzdGF0cy5hY3F1aXJlRW5kIC0gc3RhdHMuYWNxdWlyZVN0YXJ0O1xyXG4gICAgc3RhdHMubG9ja1N0YXJ0ID0gY3VycmVudFRpbWU7XHJcbiAgICBzdWJzY3JpYmVyLm5leHQoc3RhdHMpO1xyXG4gICAgc3Vic2NyaWJlci5jb21wbGV0ZSgpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGVscGVyIGZ1bmN0aW9uIHRvIHdyYXAgYWxsIHZhbHVlcyBpbiBhbiBvYmplY3QgdGhhdCBpbmNsdWRlcyB0aGUgdGltZSAoc29cclxuICAgKiB0aGF0IHdlIGNhbiBleHBpcmUgaXQgaW4gdGhlIGZ1dHVyZSkgYW5kIGpzb24uc3RyaW5naWZ5J3MgaXRcclxuICAgKi9cclxuICBwcml2YXRlIF9zZXRJdGVtKGtleSwgY2xpZW50SWQsIHRpbWVvdXQpIHtcclxuICAgIGxldCBsb2NrSXRlbSA9IG5ldyBMb2NrSXRlbSgpO1xyXG4gICAgbG9ja0l0ZW0uY2xpZW50SWQgPSBjbGllbnRJZDtcclxuICAgIGxvY2tJdGVtLmV4cGlyZXNBdCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpICsgdGltZW91dDtcclxuICAgIHJldHVybiBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShrZXksIEpTT04uc3RyaW5naWZ5KGxvY2tJdGVtKSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIZWxwZXIgZnVuY3Rpb24gdG8gcGFyc2UgSlNPTiBlbmNvZGVkIHZhbHVlcyBzZXQgaW4gbG9jYWxTdG9yYWdlXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBfZ2V0SXRlbShrZXksIHRpbWVvdXQpIHtcclxuICAgIHZhciBpdGVtID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oa2V5KTtcclxuXHJcbiAgICBpZiAoIWl0ZW0pIHJldHVybiBudWxsO1xyXG5cclxuICAgIHZhciBsb2NrSXRlbSA9IDxMb2NrSXRlbT5KU09OLnBhcnNlKGl0ZW0pO1xyXG4gICAgaWYgKG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gbG9ja0l0ZW0uZXhwaXJlc0F0ID49IHRpbWVvdXQpIHtcclxuICAgICAgdGhpcy5fY29uZmlnLmRlYnVnRW5hYmxlZCA/PyBjb25zb2xlLmRlYnVnKCdGYXN0TXV0ZXggY2xpZW50IFwiJXNcIiByZW1vdmVkIGFuIGV4cGlyZWQgcmVjb3JkIG9uIFwiJXNcIicsIHRoaXMuX2NsaWVudElkLCBrZXkpO1xyXG4gICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShrZXkpO1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbG9ja0l0ZW0uY2xpZW50SWQ7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIF9yZWxlYXNlRXhwaXJlZExvY2soa2V5OiBzdHJpbmcpe1xyXG4gICAgdmFyIGl0ZW0gPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShrZXkpO1xyXG5cclxuICAgIGlmICghaXRlbSkgcmV0dXJuIG51bGw7XHJcblxyXG4gICAgdmFyIGxvY2tJdGVtID0gPExvY2tJdGVtPkpTT04ucGFyc2UoaXRlbSk7XHJcblxyXG4gICAgaWYgKGxvY2tJdGVtLmV4cGlyZXNBdCA8PSBuZXcgRGF0ZSgpLmdldFRpbWUoKSkge1xyXG4gICAgICB0aGlzLl9jb25maWcuZGVidWdFbmFibGVkID8/IGNvbnNvbGUuZGVidWcoJ0Zhc3RNdXRleCBhdXRvIHJlbW92ZWQgYW4gZXhwaXJlZCByZWNvcmQgb24gXCIlc1wiJywga2V5KTtcclxuICAgICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oa2V5KTtcclxuICAgIH1cclxuICB9XHJcbn1cclxuIl19