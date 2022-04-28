# CnetMutexFastLock

## Usage example
```
    mutexFastLockSvc.lock('sessionId').then(stats => {
        // a lock has now been acquired
        localStorage.setItem('sessionId', sessionId);
    
        {
            restartCount: 0, // the number of times the lock process restarted
            locksLost: 0, // the number of times the lock lost to another process
            contentionCount: 0, // the number of times contending for a lock
            acquireStart: 1473872633183, // timestamp when acquisition request started
            acquireEnd: 1473872633186, // timestamp when acquisition request fulfilled
            acquireDuration: 3, // the total time taken to acquire the lock (in ms)
        }

        // release the lock when you're done.
        mutex.release('sessionId');

    }).catch((err) => {
        // ...
    })

```