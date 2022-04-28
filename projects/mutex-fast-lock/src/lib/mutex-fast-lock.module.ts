import { ModuleWithProviders, NgModule } from "@angular/core";
import { MutexFastLockConfig } from "./models/mutex-fast-lock-config";
import { MUTEX_FAST_LOCK_CONFIG } from "./mutex-fast-lock-config.injector";

@NgModule()
export class MutexFastLockModule {
  static forRoot(config: MutexFastLockConfig): ModuleWithProviders<MutexFastLockModule> {

    return ({
      ngModule: MutexFastLockModule,
      providers: [
        { provide: MUTEX_FAST_LOCK_CONFIG, useValue: config },
      ]
    });

  }
}
