import { NgModule } from "@angular/core";
import { MUTEX_FAST_LOCK_CONFIG } from "./mutex-fast-lock-config.injector";
import * as i0 from "@angular/core";
export class MutexFastLockModule {
    static forRoot(config) {
        return ({
            ngModule: MutexFastLockModule,
            providers: [
                { provide: MUTEX_FAST_LOCK_CONFIG, useValue: config },
            ]
        });
    }
}
MutexFastLockModule.ɵfac = function MutexFastLockModule_Factory(t) { return new (t || MutexFastLockModule)(); };
MutexFastLockModule.ɵmod = /*@__PURE__*/ i0.ɵɵdefineNgModule({ type: MutexFastLockModule });
MutexFastLockModule.ɵinj = /*@__PURE__*/ i0.ɵɵdefineInjector({});
(function () { (typeof ngDevMode === "undefined" || ngDevMode) && i0.ɵsetClassMetadata(MutexFastLockModule, [{
        type: NgModule
    }], null, null); })();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXV0ZXgtZmFzdC1sb2NrLm1vZHVsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3Byb2plY3RzL211dGV4LWZhc3QtbG9jay9zcmMvbGliL211dGV4LWZhc3QtbG9jay5tb2R1bGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUF1QixRQUFRLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFFOUQsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7O0FBRzNFLE1BQU0sT0FBTyxtQkFBbUI7SUFDOUIsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUEyQjtRQUV4QyxPQUFPLENBQUM7WUFDTixRQUFRLEVBQUUsbUJBQW1CO1lBQzdCLFNBQVMsRUFBRTtnQkFDVCxFQUFFLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFO2FBQ3REO1NBQ0YsQ0FBQyxDQUFDO0lBRUwsQ0FBQzs7c0ZBVlUsbUJBQW1CO3FFQUFuQixtQkFBbUI7O3VGQUFuQixtQkFBbUI7Y0FEL0IsUUFBUSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE1vZHVsZVdpdGhQcm92aWRlcnMsIE5nTW9kdWxlIH0gZnJvbSBcIkBhbmd1bGFyL2NvcmVcIjtcbmltcG9ydCB7IE11dGV4RmFzdExvY2tDb25maWcgfSBmcm9tIFwiLi9tb2RlbHMvbXV0ZXgtZmFzdC1sb2NrLWNvbmZpZ1wiO1xuaW1wb3J0IHsgTVVURVhfRkFTVF9MT0NLX0NPTkZJRyB9IGZyb20gXCIuL211dGV4LWZhc3QtbG9jay1jb25maWcuaW5qZWN0b3JcIjtcblxuQE5nTW9kdWxlKClcbmV4cG9ydCBjbGFzcyBNdXRleEZhc3RMb2NrTW9kdWxlIHtcbiAgc3RhdGljIGZvclJvb3QoY29uZmlnOiBNdXRleEZhc3RMb2NrQ29uZmlnKTogTW9kdWxlV2l0aFByb3ZpZGVyczxNdXRleEZhc3RMb2NrTW9kdWxlPiB7XG5cbiAgICByZXR1cm4gKHtcbiAgICAgIG5nTW9kdWxlOiBNdXRleEZhc3RMb2NrTW9kdWxlLFxuICAgICAgcHJvdmlkZXJzOiBbXG4gICAgICAgIHsgcHJvdmlkZTogTVVURVhfRkFTVF9MT0NLX0NPTkZJRywgdXNlVmFsdWU6IGNvbmZpZyB9LFxuICAgICAgXVxuICAgIH0pO1xuXG4gIH1cbn1cbiJdfQ==