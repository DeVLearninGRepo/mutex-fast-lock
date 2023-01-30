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
MutexFastLockModule.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "15.1.2", ngImport: i0, type: MutexFastLockModule, deps: [], target: i0.ɵɵFactoryTarget.NgModule });
MutexFastLockModule.ɵmod = i0.ɵɵngDeclareNgModule({ minVersion: "14.0.0", version: "15.1.2", ngImport: i0, type: MutexFastLockModule });
MutexFastLockModule.ɵinj = i0.ɵɵngDeclareInjector({ minVersion: "12.0.0", version: "15.1.2", ngImport: i0, type: MutexFastLockModule });
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "15.1.2", ngImport: i0, type: MutexFastLockModule, decorators: [{
            type: NgModule
        }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXV0ZXgtZmFzdC1sb2NrLm1vZHVsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3Byb2plY3RzL211dGV4LWZhc3QtbG9jay9zcmMvbGliL211dGV4LWZhc3QtbG9jay5tb2R1bGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUF1QixRQUFRLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFFOUQsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7O0FBRzNFLE1BQU0sT0FBTyxtQkFBbUI7SUFDOUIsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUEyQjtRQUV4QyxPQUFPLENBQUM7WUFDTixRQUFRLEVBQUUsbUJBQW1CO1lBQzdCLFNBQVMsRUFBRTtnQkFDVCxFQUFFLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFO2FBQ3REO1NBQ0YsQ0FBQyxDQUFDO0lBRUwsQ0FBQzs7Z0hBVlUsbUJBQW1CO2lIQUFuQixtQkFBbUI7aUhBQW5CLG1CQUFtQjsyRkFBbkIsbUJBQW1CO2tCQUQvQixRQUFRIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTW9kdWxlV2l0aFByb3ZpZGVycywgTmdNb2R1bGUgfSBmcm9tIFwiQGFuZ3VsYXIvY29yZVwiO1xuaW1wb3J0IHsgTXV0ZXhGYXN0TG9ja0NvbmZpZyB9IGZyb20gXCIuL21vZGVscy9tdXRleC1mYXN0LWxvY2stY29uZmlnXCI7XG5pbXBvcnQgeyBNVVRFWF9GQVNUX0xPQ0tfQ09ORklHIH0gZnJvbSBcIi4vbXV0ZXgtZmFzdC1sb2NrLWNvbmZpZy5pbmplY3RvclwiO1xuXG5ATmdNb2R1bGUoKVxuZXhwb3J0IGNsYXNzIE11dGV4RmFzdExvY2tNb2R1bGUge1xuICBzdGF0aWMgZm9yUm9vdChjb25maWc6IE11dGV4RmFzdExvY2tDb25maWcpOiBNb2R1bGVXaXRoUHJvdmlkZXJzPE11dGV4RmFzdExvY2tNb2R1bGU+IHtcblxuICAgIHJldHVybiAoe1xuICAgICAgbmdNb2R1bGU6IE11dGV4RmFzdExvY2tNb2R1bGUsXG4gICAgICBwcm92aWRlcnM6IFtcbiAgICAgICAgeyBwcm92aWRlOiBNVVRFWF9GQVNUX0xPQ0tfQ09ORklHLCB1c2VWYWx1ZTogY29uZmlnIH0sXG4gICAgICBdXG4gICAgfSk7XG5cbiAgfVxufVxuIl19