import { MutexFastLockConfig } from './models/mutex-fast-lock-config';
import { MutexLockStats } from './models/mutex-lock-stats';
import { Observable } from 'rxjs';
import * as i0 from "@angular/core";
export declare class MutexFastLockService {
    private readonly _config;
    private _clientId;
    private _xPrefix;
    private _yPrefix;
    constructor(_config: MutexFastLockConfig);
    lock(key: string, timeout?: number): Observable<MutexLockStats>;
    release(key: any): void;
    private _generateRandomId;
    private resetStats;
    private resolveWithStats;
    /**
     * Helper function to wrap all values in an object that includes the time (so
     * that we can expire it in the future) and json.stringify's it
     */
    private _setItem;
    /**
     * Helper function to parse JSON encoded values set in localStorage
     */
    private _getItem;
    private _releaseExpiredLock;
    static ɵfac: i0.ɵɵFactoryDeclaration<MutexFastLockService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<MutexFastLockService>;
}
