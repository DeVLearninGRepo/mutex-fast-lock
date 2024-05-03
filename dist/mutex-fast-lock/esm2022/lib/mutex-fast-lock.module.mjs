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
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.7", ngImport: i0, type: MutexFastLockModule, deps: [], target: i0.ɵɵFactoryTarget.NgModule });
    static ɵmod = i0.ɵɵngDeclareNgModule({ minVersion: "14.0.0", version: "17.3.7", ngImport: i0, type: MutexFastLockModule });
    static ɵinj = i0.ɵɵngDeclareInjector({ minVersion: "12.0.0", version: "17.3.7", ngImport: i0, type: MutexFastLockModule });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.7", ngImport: i0, type: MutexFastLockModule, decorators: [{
            type: NgModule
        }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXV0ZXgtZmFzdC1sb2NrLm1vZHVsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3Byb2plY3RzL211dGV4LWZhc3QtbG9jay9zcmMvbGliL211dGV4LWZhc3QtbG9jay5tb2R1bGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUF1QixRQUFRLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFFOUQsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7O0FBRzNFLE1BQU0sT0FBTyxtQkFBbUI7SUFDOUIsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUEyQjtRQUV4QyxPQUFPLENBQUM7WUFDTixRQUFRLEVBQUUsbUJBQW1CO1lBQzdCLFNBQVMsRUFBRTtnQkFDVCxFQUFFLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFO2FBQ3REO1NBQ0YsQ0FBQyxDQUFDO0lBRUwsQ0FBQzt1R0FWVSxtQkFBbUI7d0dBQW5CLG1CQUFtQjt3R0FBbkIsbUJBQW1COzsyRkFBbkIsbUJBQW1CO2tCQUQvQixRQUFRIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTW9kdWxlV2l0aFByb3ZpZGVycywgTmdNb2R1bGUgfSBmcm9tIFwiQGFuZ3VsYXIvY29yZVwiO1xyXG5pbXBvcnQgeyBNdXRleEZhc3RMb2NrQ29uZmlnIH0gZnJvbSBcIi4vbW9kZWxzL211dGV4LWZhc3QtbG9jay1jb25maWdcIjtcclxuaW1wb3J0IHsgTVVURVhfRkFTVF9MT0NLX0NPTkZJRyB9IGZyb20gXCIuL211dGV4LWZhc3QtbG9jay1jb25maWcuaW5qZWN0b3JcIjtcclxuXHJcbkBOZ01vZHVsZSgpXHJcbmV4cG9ydCBjbGFzcyBNdXRleEZhc3RMb2NrTW9kdWxlIHtcclxuICBzdGF0aWMgZm9yUm9vdChjb25maWc6IE11dGV4RmFzdExvY2tDb25maWcpOiBNb2R1bGVXaXRoUHJvdmlkZXJzPE11dGV4RmFzdExvY2tNb2R1bGU+IHtcclxuXHJcbiAgICByZXR1cm4gKHtcclxuICAgICAgbmdNb2R1bGU6IE11dGV4RmFzdExvY2tNb2R1bGUsXHJcbiAgICAgIHByb3ZpZGVyczogW1xyXG4gICAgICAgIHsgcHJvdmlkZTogTVVURVhfRkFTVF9MT0NLX0NPTkZJRywgdXNlVmFsdWU6IGNvbmZpZyB9LFxyXG4gICAgICBdXHJcbiAgICB9KTtcclxuXHJcbiAgfVxyXG59XHJcbiJdfQ==