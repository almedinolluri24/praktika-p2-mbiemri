<?php

use App\Http\Controllers\Api\PublicCatalogController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\ManagerController;
use Illuminate\Support\Facades\Route;

Route::get('/restaurants', [PublicCatalogController::class, 'restaurants']);
Route::get('/catalog/filters', [PublicCatalogController::class, 'filters']);
Route::get('/restaurants/{restaurant}/branches', [PublicCatalogController::class, 'branches'])->whereNumber('restaurant');
Route::get('/branches/{branch}/products', [PublicCatalogController::class, 'products'])->whereNumber('branch');
Route::get('/branches/{branch}/pickup-slots', [PublicCatalogController::class, 'pickupSlots'])->whereNumber('branch');

Route::middleware('web')->group(function (): void {
    Route::middleware('auth')->group(function (): void {
        Route::get('/admin/restaurants', [AdminController::class, 'restaurants']);
        Route::get('/admin/branches', [AdminController::class, 'branches']);
        Route::get('/admin/staff-accounts', [AdminController::class, 'staffAccounts']);
        Route::get('/admin/branches/{branch}/staff', [AdminController::class, 'branchStaff'])->whereNumber('branch');
        Route::post('/admin/branches/{branch}/staff', [AdminController::class, 'assignStaff'])->whereNumber('branch');
        Route::delete('/admin/branches/{branch}/staff/{user}', [AdminController::class, 'removeStaff'])->whereNumber('branch')->whereNumber('user');
        Route::patch('/admin/restaurants/{restaurant}/status', [AdminController::class, 'setRestaurantStatus'])->whereNumber('restaurant');
        Route::get('/admin/restaurants/{restaurant}/categories', [AdminController::class, 'categories'])->whereNumber('restaurant');
        Route::post('/admin/restaurants/{restaurant}/categories', [AdminController::class, 'createCategory'])->whereNumber('restaurant');
        Route::patch('/admin/restaurants/{restaurant}/categories/{category}', [AdminController::class, 'updateCategory'])->whereNumber('restaurant')->whereNumber('category');
        Route::get('/manager/branches', [ManagerController::class, 'branches']);
        Route::get('/manager/branches/{branch}/staff', [ManagerController::class, 'staff'])->whereNumber('branch');
        Route::post('/manager/branches/{branch}/staff', [ManagerController::class, 'assignStaff'])->whereNumber('branch');
        Route::delete('/manager/branches/{branch}/staff/{user}', [ManagerController::class, 'removeStaff'])->whereNumber('branch')->whereNumber('user');
        Route::get('/manager/branches/{branch}/products', [ManagerController::class, 'products'])->whereNumber('branch');
        Route::post('/manager/branches/{branch}/categories', [ManagerController::class, 'createCategory'])->whereNumber('branch');
        Route::post('/manager/branches/{branch}/products', [ManagerController::class, 'createProduct'])->whereNumber('branch');
        Route::patch('/manager/branches/{branch}/products/{product}', [ManagerController::class, 'updateProduct'])->whereNumber('branch')->whereNumber('product');
        Route::get('/manager/branches/{branch}/hours', [ManagerController::class, 'hours'])->whereNumber('branch');
        Route::put('/manager/branches/{branch}/hours', [ManagerController::class, 'updateHours'])->whereNumber('branch');
        Route::get('/manager/branches/{branch}/reports', [ManagerController::class, 'report'])->whereNumber('branch');
        Route::get('/orders', [OrderController::class, 'index']);
        Route::post('/orders', [OrderController::class, 'store'])->middleware('throttle:20,1');
        Route::post('/orders/{order}/items/{item}/complete', [OrderController::class, 'completeItem'])->whereNumber('order')->whereNumber('item');
        Route::post('/orders/{order}/packaging-confirmed', [OrderController::class, 'confirmPackaging'])->whereNumber('order');
        Route::get('/kitchen/queue', [OrderController::class, 'kitchenQueue']);
        Route::get('/notifications', [OrderController::class, 'notifications']);
        Route::post('/notifications/{notification}/read', [OrderController::class, 'markNotificationRead']);
        Route::get('/orders/{order}', [OrderController::class, 'show'])->whereNumber('order');
        Route::patch('/orders/{order}/status', [OrderController::class, 'transition'])->whereNumber('order');
        Route::patch('/orders/{order}/eta', [OrderController::class, 'updateEta'])->whereNumber('order');
        Route::post('/orders/{order}/payment', [OrderController::class, 'recordPayment'])->whereNumber('order')->middleware('throttle:20,1');
        Route::post('/orders/{order}/pickup', [OrderController::class, 'redeemPickup'])->whereNumber('order')->middleware('throttle:20,1');
    });
});
