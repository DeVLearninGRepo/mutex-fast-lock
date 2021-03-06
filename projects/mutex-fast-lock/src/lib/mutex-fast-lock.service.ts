import { Inject, Injectable } from '@angular/core';
import { MUTEX_FAST_LOCK_CONFIG } from './mutex-fast-lock-config.injector';
import { MutexFastLockConfig } from './models/mutex-fast-lock-config';
import { MutexLockStats } from './models/mutex-lock-stats';
import { Observable, Subscriber } from 'rxjs';
import { LockItem } from './models/lock-item';

@Injectable({
  providedIn: 'root'
})
export class MutexFastLockService {

  private _clientId: string;
  private _xPrefix: string;
  private _yPrefix: string;

  constructor(
    @Inject(MUTEX_FAST_LOCK_CONFIG) private readonly _config: MutexFastLockConfig,
  ) {
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

  public lock(key: string, timeout: number = -1) {
    let that = this;

    if (timeout == -1) timeout = this._config.timeout;

    let xLock = that._xPrefix + key;
    let yLock = that._yPrefix + key;

    let lockStats: MutexLockStats = new MutexLockStats();

    that.resetStats(lockStats);

    this._config.debugEnabled ?? console.debug('Attempting to acquire Lock on "%s" using FastMutex instance "%s"', key, this._clientId);

    lockStats.acquireStart = new Date().getTime();

    //return new Promise(function (resolve, reject) {
    return new Observable<MutexLockStats>(subscriber => {
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
            } else {
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

  public release(key) {
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

  private _generateRandomId() {
    return Math.floor(Math.random() * 10000000000) + '';
  }

  private resetStats(lockStats: MutexLockStats) {
    lockStats.restartCount = 0;
    lockStats.locksLost = 0;
    lockStats.contentionCount = 0;
    lockStats.acquireDuration = 0;
    lockStats.acquireStart = null;
  }

  private resolveWithStats(subscriber: Subscriber<MutexLockStats>, stats: MutexLockStats) {
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
  private _setItem(key, clientId, timeout) {
    let lockItem = new LockItem();
    lockItem.clientId = clientId;
    lockItem.expiresAt = new Date().getTime() + timeout;
    return localStorage.setItem(key, JSON.stringify(lockItem));
  }

  /**
   * Helper function to parse JSON encoded values set in localStorage
   */
  private _getItem(key, timeout) {
    var item = localStorage.getItem(key);

    if (!item) return null;

    var lockItem = <LockItem>JSON.parse(item);
    if (new Date().getTime() - lockItem.expiresAt >= timeout) {
      this._config.debugEnabled ?? console.debug('FastMutex client "%s" removed an expired record on "%s"', this._clientId, key);
      localStorage.removeItem(key);
      return null;
    }

    return lockItem.clientId;
  }

  private _releaseExpiredLock(key: string){
    var item = localStorage.getItem(key);

    if (!item) return null;

    var lockItem = <LockItem>JSON.parse(item);

    if (lockItem.expiresAt <= new Date().getTime()) {
      this._config.debugEnabled ?? console.debug('FastMutex auto removed an expired record on "%s"', key);
      localStorage.removeItem(key);
    }
  }
}
