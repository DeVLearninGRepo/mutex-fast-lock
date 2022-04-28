import { InjectionToken } from '@angular/core';
import { MutexFastLockConfig } from './models/mutex-fast-lock-config';

export const MUTEX_FAST_LOCK_CONFIG = new InjectionToken<MutexFastLockConfig>('MUTEX_FAST_LOCK_CONFIG');