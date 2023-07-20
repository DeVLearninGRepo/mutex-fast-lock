import { Inject, Injectable } from '@angular/core';
import { MUTEX_FAST_LOCK_CONFIG } from './mutex-fast-lock-config.injector';
import { MutexLockStats } from './models/mutex-lock-stats';
import { Observable } from 'rxjs';
import { LockItem } from './models/lock-item';
import * as i0 from "@angular/core";
import * as i1 from "./models/mutex-fast-lock-config";
class MutexFastLockService {
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
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "16.1.6", ngImport: i0, type: MutexFastLockService, deps: [{ token: MUTEX_FAST_LOCK_CONFIG }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "16.1.6", ngImport: i0, type: MutexFastLockService, providedIn: 'root' });
}
export { MutexFastLockService };
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "16.1.6", ngImport: i0, type: MutexFastLockService, decorators: [{
            type: Injectable,
            args: [{
                    providedIn: 'root'
                }]
        }], ctorParameters: function () { return [{ type: i1.MutexFastLockConfig, decorators: [{
                    type: Inject,
                    args: [MUTEX_FAST_LOCK_CONFIG]
                }] }]; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXV0ZXgtZmFzdC1sb2NrLnNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9wcm9qZWN0cy9tdXRleC1mYXN0LWxvY2svc3JjL2xpYi9tdXRleC1mYXN0LWxvY2suc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUNuRCxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUUzRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDM0QsT0FBTyxFQUFFLFVBQVUsRUFBYyxNQUFNLE1BQU0sQ0FBQztBQUM5QyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7OztBQUU5QyxNQUdhLG9CQUFvQjtJQU9vQjtJQUwzQyxTQUFTLENBQVM7SUFDbEIsUUFBUSxDQUFTO0lBQ2pCLFFBQVEsQ0FBUztJQUV6QixZQUNtRCxPQUE0QjtRQUE1QixZQUFPLEdBQVAsT0FBTyxDQUFxQjtRQUU3RSxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBQzFDLElBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUM7UUFDM0MsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztRQUUzQyxJQUFJLElBQUksR0FBRyxJQUFJLENBQUM7UUFDaEIsTUFBTSxDQUFDLGdCQUFnQixDQUFDLGNBQWMsRUFBRSxVQUFVLEVBQUU7WUFDbEQsSUFBSSxHQUFHLEdBQUcsRUFBRSxDQUFDO1lBRWIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFlBQVksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Z0JBQzVDLElBQUksWUFBWSxDQUFDLEdBQUcsQ0FB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bmplY3QsIEluamVjdGFibGUgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcclxuaW1wb3J0IHsgTVVURVhfRkFTVF9MT0NLX0NPTkZJRyB9IGZyb20gJy4vbXV0ZXgtZmFzdC1sb2NrLWNvbmZpZy5pbmplY3Rvcic7XHJcbmltcG9ydCB7IE11dGV4RmFzdExvY2tDb25maWcgfSBmcm9tICcuL21vZGVscy9tdXRleC1mYXN0LWxvY2stY29uZmlnJztcclxuaW1wb3J0IHsgTXV0ZXhMb2NrU3RhdHMgfSBmcm9tICcuL21vZGVscy9tdXRleC1sb2NrLXN0YXRzJztcclxuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgU3Vic2NyaWJlciB9IGZyb20gJ3J4anMnO1xyXG5pbXBvcnQgeyBMb2NrSXRlbSB9IGZyb20gJy4vbW9kZWxzL2xvY2staXRlbSc7XHJcblxyXG5ASW5qZWN0YWJsZSh7XHJcbiAgcHJvdmlkZWRJbjogJ3Jvb3QnXHJcbn0pXHJcbmV4cG9ydCBjbGFzcyBNdXRleEZhc3RMb2NrU2VydmljZSB7XHJcblxyXG4gIHByaXZhdGUgX2NsaWVudElkOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBfeFByZWZpeDogc3RyaW5nO1xyXG4gIHByaXZhdGUgX3lQcmVmaXg6IHN0cmluZztcclxuXHJcbiAgY29uc3RydWN0b3IoXHJcbiAgICBASW5qZWN0KE1VVEVYX0ZBU1RfTE9DS19DT05GSUcpIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZzogTXV0ZXhGYXN0TG9ja0NvbmZpZyxcclxuICApIHtcclxuICAgIHRoaXMuX2NsaWVudElkID0gdGhpcy5fZ2VuZXJhdGVSYW5kb21JZCgpO1xyXG4gICAgdGhpcy5feFByZWZpeCA9IF9jb25maWcubG9ja1ByZWZpeCArICdfWF8nO1xyXG4gICAgdGhpcy5feVByZWZpeCA9IF9jb25maWcubG9ja1ByZWZpeCArICdfWV8nO1xyXG5cclxuICAgIGxldCB0aGF0ID0gdGhpcztcclxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwiYmVmb3JldW5sb2FkXCIsIGZ1bmN0aW9uIChldikge1xyXG4gICAgICB2YXIgYXJyID0gW107XHJcblxyXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxvY2FsU3RvcmFnZS5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGlmIChsb2NhbFN0b3JhZ2Uua2V5KGkpLmluZGV4T2YodGhhdC5feFByZWZpeCkgPT0gMFxyXG4gICAgICAgICAgfHwgbG9jYWxTdG9yYWdlLmtleShpKS5pbmRleE9mKHRoYXQuX3lQcmVmaXgpID09IDApIHtcclxuICAgICAgICAgIGFyci5wdXNoKGxvY2FsU3RvcmFnZS5rZXkoaSkpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShhcnJbaV0pO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBsb2NrKGtleTogc3RyaW5nLCB0aW1lb3V0OiBudW1iZXIgPSAtMSkge1xyXG4gICAgbGV0IHRoYXQgPSB0aGlzO1xyXG5cclxuICAgIGlmICh0aW1lb3V0ID09IC0xKSB0aW1lb3V0ID0gdGhpcy5fY29uZmlnLnRpbWVvdXQ7XHJcblxyXG4gICAgbGV0IHhMb2NrID0gdGhhdC5feFByZWZpeCArIGtleTtcclxuICAgIGxldCB5TG9jayA9IHRoYXQuX3lQcmVmaXggKyBrZXk7XHJcblxyXG4gICAgbGV0IGxvY2tTdGF0czogTXV0ZXhMb2NrU3RhdHMgPSBuZXcgTXV0ZXhMb2NrU3RhdHMoKTtcclxuXHJcbiAgICB0aGF0LnJlc2V0U3RhdHMobG9ja1N0YXRzKTtcclxuXHJcbiAgICB0aGlzLl9jb25maWcuZGVidWdFbmFibGVkID8/IGNvbnNvbGUuZGVidWcoJ0F0dGVtcHRpbmcgdG8gYWNxdWlyZSBMb2NrIG9uIFwiJXNcIiB1c2luZyBGYXN0TXV0ZXggaW5zdGFuY2UgXCIlc1wiJywga2V5LCB0aGlzLl9jbGllbnRJZCk7XHJcblxyXG4gICAgbG9ja1N0YXRzLmFjcXVpcmVTdGFydCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xyXG5cclxuICAgIC8vcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZTxNdXRleExvY2tTdGF0cz4oc3Vic2NyaWJlciA9PiB7XHJcbiAgICAgIC8vIHdlIG5lZWQgdG8gZGlmZmVyZW50aWF0ZSBiZXR3ZWVuIEFQSSBjYWxscyB0byBsb2NrKCkgYW5kIG91ciBpbnRlcm5hbFxyXG4gICAgICAvLyByZWN1cnNpdmUgY2FsbHMgc28gdGhhdCB3ZSBjYW4gdGltZW91dCBiYXNlZCBvbiB0aGUgb3JpZ2luYWwgbG9jaygpIGFuZFxyXG4gICAgICAvLyBub3QgZWFjaCBzdWJzZXF1ZW50IGNhbGwuICBUaGVyZWZvcmUsIGNyZWF0ZSBhIG5ldyBmdW5jdGlvbiBoZXJlIHdpdGhpblxyXG4gICAgICAvLyB0aGUgcHJvbWlzZSBjbG9zdXJlIHRoYXQgd2UgdXNlIGZvciBzdWJzZXF1ZW50IGNhbGxzOlxyXG4gICAgICBsZXQgYWNxdWlyZUxvY2sgPSBmdW5jdGlvbiBhY3F1aXJlTG9jayhrZXkpIHtcclxuXHJcbiAgICAgICAgdGhhdC5fcmVsZWFzZUV4cGlyZWRMb2NrKHhMb2NrKTtcclxuICAgICAgICB0aGF0Ll9yZWxlYXNlRXhwaXJlZExvY2soeUxvY2spO1xyXG5cclxuICAgICAgICB2YXIgZWxhcHNlZFRpbWUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIGxvY2tTdGF0cy5hY3F1aXJlU3RhcnQ7XHJcbiAgICAgICAgaWYgKGVsYXBzZWRUaW1lID49IHRpbWVvdXQpIHtcclxuICAgICAgICAgIHRoYXQuX2NvbmZpZy5kZWJ1Z0VuYWJsZWQgPz8gY29uc29sZS5kZWJ1ZygnTG9jayBvbiBcIiVzXCIgY291bGQgbm90IGJlIGFjcXVpcmVkIHdpdGhpbiAlc21zIGJ5IEZhc3RNdXRleCBjbGllbnQgXCIlc1wiJywga2V5LCB0aW1lb3V0LCB0aGF0Ll9jbGllbnRJZCk7XHJcbiAgICAgICAgICBzdWJzY3JpYmVyLmVycm9yKG5ldyBFcnJvcignTG9jayBjb3VsZCBub3QgYmUgYWNxdWlyZWQgd2l0aGluICcgKyB0aW1lb3V0ICsgJ21zJykpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhhdC5fc2V0SXRlbSh4TG9jaywgdGhhdC5fY2xpZW50SWQsIHRpbWVvdXQpO1xyXG5cclxuICAgICAgICAvLyBpZiB5IGV4aXN0cywgYW5vdGhlciBjbGllbnQgaXMgZ2V0dGluZyBhIGxvY2ssIHNvIHJldHJ5IGluIGEgYml0XHJcbiAgICAgICAgdmFyIGxzWSA9IHRoYXQuX2dldEl0ZW0oeUxvY2ssIHRpbWVvdXQpO1xyXG4gICAgICAgIGlmIChsc1kpIHtcclxuICAgICAgICAgIHRoYXQuX2NvbmZpZy5kZWJ1Z0VuYWJsZWQgPz8gY29uc29sZS5kZWJ1ZygnTG9jayBleGlzdHMgb24gWSAoJXMpLCByZXN0YXJ0aW5nLi4uJywgbHNZKTtcclxuICAgICAgICAgIGxvY2tTdGF0cy5yZXN0YXJ0Q291bnQrKztcclxuICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gYWNxdWlyZUxvY2soa2V5KTtcclxuICAgICAgICAgIH0sIDEwKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIGFzayBmb3IgaW5uZXIgbG9ja1xyXG4gICAgICAgIHRoYXQuX3NldEl0ZW0oeUxvY2ssIHRoYXQuX2NsaWVudElkLCB0aW1lb3V0KTtcclxuXHJcbiAgICAgICAgLy8gaWYgeCB3YXMgY2hhbmdlZCwgYW5vdGhlciBjbGllbnQgaXMgY29udGVuZGluZyBmb3IgYW4gaW5uZXIgbG9ja1xyXG4gICAgICAgIHZhciBsc1ggPSB0aGF0Ll9nZXRJdGVtKHhMb2NrLCB0aW1lb3V0KTtcclxuICAgICAgICBpZiAobHNYICE9PSB0aGF0Ll9jbGllbnRJZCkge1xyXG4gICAgICAgICAgbG9ja1N0YXRzLmNvbnRlbnRpb25Db3VudCsrO1xyXG4gICAgICAgICAgdGhhdC5fY29uZmlnLmRlYnVnRW5hYmxlZCA/PyBjb25zb2xlLmRlYnVnKCdMb2NrIGNvbnRlbnRpb24gZGV0ZWN0ZWQuIFg9XCIlc1wiJywgbHNYKTtcclxuXHJcbiAgICAgICAgICAvLyBHaXZlIGVub3VnaCB0aW1lIGZvciBjcml0aWNhbCBzZWN0aW9uOlxyXG4gICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGxzWSA9IHRoYXQuX2dldEl0ZW0oeUxvY2ssIHRpbWVvdXQpO1xyXG4gICAgICAgICAgICBpZiAobHNZID09PSB0aGF0Ll9jbGllbnRJZCkge1xyXG4gICAgICAgICAgICAgIC8vIHdlIGhhdmUgYSBsb2NrXHJcbiAgICAgICAgICAgICAgdGhhdC5fY29uZmlnLmRlYnVnRW5hYmxlZCA/PyBjb25zb2xlLmRlYnVnKCdGYXN0TXV0ZXggY2xpZW50IFwiJXNcIiB3b24gdGhlIGxvY2sgY29udGVudGlvbiBvbiBcIiVzXCInLCB0aGF0Ll9jbGllbnRJZCwga2V5KTtcclxuICAgICAgICAgICAgICB0aGF0LnJlc29sdmVXaXRoU3RhdHMoc3Vic2NyaWJlciwgbG9ja1N0YXRzKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAvLyB3ZSBsb3N0IHRoZSBsb2NrLCByZXN0YXJ0IHRoZSBwcm9jZXNzIGFnYWluXHJcbiAgICAgICAgICAgICAgbG9ja1N0YXRzLnJlc3RhcnRDb3VudCsrO1xyXG4gICAgICAgICAgICAgIGxvY2tTdGF0cy5sb2Nrc0xvc3QrKztcclxuICAgICAgICAgICAgICB0aGF0Ll9jb25maWcuZGVidWdFbmFibGVkID8/IGNvbnNvbGUuZGVidWcoJ0Zhc3RNdXRleCBjbGllbnQgXCIlc1wiIGxvc3QgdGhlIGxvY2sgY29udGVudGlvbiBvbiBcIiVzXCIgdG8gYW5vdGhlciBwcm9jZXNzICglcykuIFJlc3RhcnRpbmcuLi4nLCB0aGF0Ll9jbGllbnRJZCwga2V5LCBsc1kpO1xyXG4gICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGFjcXVpcmVMb2NrKGtleSk7XHJcbiAgICAgICAgICAgICAgfSwgMTApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9LCAxMDApO1xyXG5cclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIG5vIGNvbnRlbnRpb246XHJcbiAgICAgICAgdGhhdC5fY29uZmlnLmRlYnVnRW5hYmxlZCA/PyBjb25zb2xlLmRlYnVnKCdGYXN0TXV0ZXggY2xpZW50IFwiJXNcIiBhY3F1aXJlZCBhIGxvY2sgb24gXCIlc1wiIHdpdGggbm8gY29udGVudGlvbicsIHRoYXQuX2NsaWVudElkLCBrZXkpO1xyXG4gICAgICAgIHRoYXQucmVzb2x2ZVdpdGhTdGF0cyhzdWJzY3JpYmVyLCBsb2NrU3RhdHMpO1xyXG4gICAgICB9O1xyXG5cclxuICAgICAgYWNxdWlyZUxvY2soa2V5KTtcclxuXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyByZWxlYXNlKGtleSkge1xyXG4gICAgdGhpcy5fY29uZmlnLmRlYnVnRW5hYmxlZCA/PyBjb25zb2xlLmRlYnVnKCdGYXN0TXV0ZXggY2xpZW50IFwiJXNcIiBpcyByZWxlYXNpbmcgbG9jayBvbiBcIiVzXCInLCB0aGlzLl9jbGllbnRJZCwga2V5KTtcclxuXHJcbiAgICBsZXQgeCA9IHRoaXMuX3hQcmVmaXggKyBrZXk7XHJcbiAgICBsZXQgeSA9IHRoaXMuX3lQcmVmaXggKyBrZXk7XHJcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSh4KTtcclxuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKHkpO1xyXG5cclxuICAgIC8vdGhhdC5sb2NrU3RhdHMubG9ja0VuZCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xyXG4gICAgLy90aGF0LmxvY2tTdGF0cy5sb2NrRHVyYXRpb24gPSB0aGF0LmxvY2tTdGF0cy5sb2NrRW5kIC0gdGhhdC5sb2NrU3RhdHMubG9ja1N0YXJ0O1xyXG5cclxuICAgIC8vbGV0IHJldFN0YXRzID0gYW5ndWxhci5jb3B5KHRoYXQubG9ja1N0YXRzKTtcclxuXHJcbiAgICAvL3RoYXQucmVzZXRTdGF0cygpO1xyXG5cclxuICAgIC8vcmV0dXJuIHJldFN0YXRzO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBfZ2VuZXJhdGVSYW5kb21JZCgpIHtcclxuICAgIHJldHVybiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMDAwMDAwMDAwMCkgKyAnJztcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVzZXRTdGF0cyhsb2NrU3RhdHM6IE11dGV4TG9ja1N0YXRzKSB7XHJcbiAgICBsb2NrU3RhdHMucmVzdGFydENvdW50ID0gMDtcclxuICAgIGxvY2tTdGF0cy5sb2Nrc0xvc3QgPSAwO1xyXG4gICAgbG9ja1N0YXRzLmNvbnRlbnRpb25Db3VudCA9IDA7XHJcbiAgICBsb2NrU3RhdHMuYWNxdWlyZUR1cmF0aW9uID0gMDtcclxuICAgIGxvY2tTdGF0cy5hY3F1aXJlU3RhcnQgPSBudWxsO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZXNvbHZlV2l0aFN0YXRzKHN1YnNjcmliZXI6IFN1YnNjcmliZXI8TXV0ZXhMb2NrU3RhdHM+LCBzdGF0czogTXV0ZXhMb2NrU3RhdHMpIHtcclxuICAgIHZhciBjdXJyZW50VGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xyXG4gICAgc3RhdHMuYWNxdWlyZUVuZCA9IGN1cnJlbnRUaW1lO1xyXG4gICAgc3RhdHMuYWNxdWlyZUR1cmF0aW9uID0gc3RhdHMuYWNxdWlyZUVuZCAtIHN0YXRzLmFjcXVpcmVTdGFydDtcclxuICAgIHN0YXRzLmxvY2tTdGFydCA9IGN1cnJlbnRUaW1lO1xyXG4gICAgc3Vic2NyaWJlci5uZXh0KHN0YXRzKTtcclxuICAgIHN1YnNjcmliZXIuY29tcGxldGUoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhlbHBlciBmdW5jdGlvbiB0byB3cmFwIGFsbCB2YWx1ZXMgaW4gYW4gb2JqZWN0IHRoYXQgaW5jbHVkZXMgdGhlIHRpbWUgKHNvXHJcbiAgICogdGhhdCB3ZSBjYW4gZXhwaXJlIGl0IGluIHRoZSBmdXR1cmUpIGFuZCBqc29uLnN0cmluZ2lmeSdzIGl0XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBfc2V0SXRlbShrZXksIGNsaWVudElkLCB0aW1lb3V0KSB7XHJcbiAgICBsZXQgbG9ja0l0ZW0gPSBuZXcgTG9ja0l0ZW0oKTtcclxuICAgIGxvY2tJdGVtLmNsaWVudElkID0gY2xpZW50SWQ7XHJcbiAgICBsb2NrSXRlbS5leHBpcmVzQXQgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSArIHRpbWVvdXQ7XHJcbiAgICByZXR1cm4gbG9jYWxTdG9yYWdlLnNldEl0ZW0oa2V5LCBKU09OLnN0cmluZ2lmeShsb2NrSXRlbSkpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGVscGVyIGZ1bmN0aW9uIHRvIHBhcnNlIEpTT04gZW5jb2RlZCB2YWx1ZXMgc2V0IGluIGxvY2FsU3RvcmFnZVxyXG4gICAqL1xyXG4gIHByaXZhdGUgX2dldEl0ZW0oa2V5LCB0aW1lb3V0KSB7XHJcbiAgICB2YXIgaXRlbSA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKGtleSk7XHJcblxyXG4gICAgaWYgKCFpdGVtKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgICB2YXIgbG9ja0l0ZW0gPSA8TG9ja0l0ZW0+SlNPTi5wYXJzZShpdGVtKTtcclxuICAgIGlmIChuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIGxvY2tJdGVtLmV4cGlyZXNBdCA+PSB0aW1lb3V0KSB7XHJcbiAgICAgIHRoaXMuX2NvbmZpZy5kZWJ1Z0VuYWJsZWQgPz8gY29uc29sZS5kZWJ1ZygnRmFzdE11dGV4IGNsaWVudCBcIiVzXCIgcmVtb3ZlZCBhbiBleHBpcmVkIHJlY29yZCBvbiBcIiVzXCInLCB0aGlzLl9jbGllbnRJZCwga2V5KTtcclxuICAgICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oa2V5KTtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGxvY2tJdGVtLmNsaWVudElkO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBfcmVsZWFzZUV4cGlyZWRMb2NrKGtleTogc3RyaW5nKXtcclxuICAgIHZhciBpdGVtID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oa2V5KTtcclxuXHJcbiAgICBpZiAoIWl0ZW0pIHJldHVybiBudWxsO1xyXG5cclxuICAgIHZhciBsb2NrSXRlbSA9IDxMb2NrSXRlbT5KU09OLnBhcnNlKGl0ZW0pO1xyXG5cclxuICAgIGlmIChsb2NrSXRlbS5leHBpcmVzQXQgPD0gbmV3IERhdGUoKS5nZXRUaW1lKCkpIHtcclxuICAgICAgdGhpcy5fY29uZmlnLmRlYnVnRW5hYmxlZCA/PyBjb25zb2xlLmRlYnVnKCdGYXN0TXV0ZXggYXV0byByZW1vdmVkIGFuIGV4cGlyZWQgcmVjb3JkIG9uIFwiJXNcIicsIGtleSk7XHJcbiAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKGtleSk7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcbiJdfQ==