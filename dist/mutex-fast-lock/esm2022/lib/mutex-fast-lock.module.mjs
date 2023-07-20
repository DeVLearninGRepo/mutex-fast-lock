import { NgModule } from "@angular/core";
import { MUTEX_FAST_LOCK_CONFIG } from "./mutex-fast-lock-config.injector";
import * as i0 from "@angular/core";
class MutexFastLockModule {
    static forRoot(config) {
        return ({
            ngModule: MutexFastLockModule,
            providers: [
                { provide: MUTEX_FAST_LOCK_CONFIG, useValue: config },
            ]
        });
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "16.1.6", ngImport: i0, type: MutexFastLockModule, deps: [], target: i0.ɵɵFactoryTarget.NgModule });
    static ɵmod = i0.ɵɵngDeclareNgModule({ minVersion: "14.0.0", version: "16.1.6", ngImport: i0, type: MutexFastLockModule });
    static ɵinj = i0.ɵɵngDeclareInjector({ minVersion: "12.0.0", version: "16.1.6", ngImport: i0, type: MutexFastLockModule });
}
export { MutexFastLockModule };
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "16.1.6", ngImport: i0, type: MutexFastLockModule, decorators: [{
            type: NgModule
        }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXV0ZXgtZmFzdC1sb2NrLm1vZHVsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3Byb2plY3RzL211dGV4LWZhc3QtbG9jay9zcmMvbGliL211dGV4LWZhc3QtbG9jay5tb2R1bGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUF1QixRQUFRLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFFOUQsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7O0FBRTNFLE1BQ2EsbUJBQW1CO0lBQzlCLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBMkI7UUFFeEMsT0FBTyxDQUFDO1lBQ04sUUFBUSxFQUFFLG1CQUFtQjtZQUM3QixTQUFTLEVBQUU7Z0JBQ1QsRUFBRSxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRTthQUN0RDtTQUNGLENBQUMsQ0FBQztJQUVMLENBQUM7dUdBVlUsbUJBQW1CO3dHQUFuQixtQkFBbUI7d0dBQW5CLG1CQUFtQjs7U0FBbkIsbUJBQW1COzJGQUFuQixtQkFBbUI7a0JBRC9CLFFBQVEiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBNb2R1bGVXaXRoUHJvdmlkZXJzLCBOZ01vZHVsZSB9IGZyb20gXCJAYW5ndWxhci9jb3JlXCI7XHJcbmltcG9ydCB7IE11dGV4RmFzdExvY2tDb25maWcgfSBmcm9tIFwiLi9tb2RlbHMvbXV0ZXgtZmFzdC1sb2NrLWNvbmZpZ1wiO1xyXG5pbXBvcnQgeyBNVVRFWF9GQVNUX0xPQ0tfQ09ORklHIH0gZnJvbSBcIi4vbXV0ZXgtZmFzdC1sb2NrLWNvbmZpZy5pbmplY3RvclwiO1xyXG5cclxuQE5nTW9kdWxlKClcclxuZXhwb3J0IGNsYXNzIE11dGV4RmFzdExvY2tNb2R1bGUge1xyXG4gIHN0YXRpYyBmb3JSb290KGNvbmZpZzogTXV0ZXhGYXN0TG9ja0NvbmZpZyk6IE1vZHVsZVdpdGhQcm92aWRlcnM8TXV0ZXhGYXN0TG9ja01vZHVsZT4ge1xyXG5cclxuICAgIHJldHVybiAoe1xyXG4gICAgICBuZ01vZHVsZTogTXV0ZXhGYXN0TG9ja01vZHVsZSxcclxuICAgICAgcHJvdmlkZXJzOiBbXHJcbiAgICAgICAgeyBwcm92aWRlOiBNVVRFWF9GQVNUX0xPQ0tfQ09ORklHLCB1c2VWYWx1ZTogY29uZmlnIH0sXHJcbiAgICAgIF1cclxuICAgIH0pO1xyXG5cclxuICB9XHJcbn1cclxuIl19