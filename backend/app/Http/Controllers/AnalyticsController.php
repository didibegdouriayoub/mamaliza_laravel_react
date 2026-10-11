<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use App\Models\Customer;
use App\Models\InventoryItem;
use App\Models\Order;
use Illuminate\Http\Request;

class AnalyticsController extends Controller
{
    public function dashboard(Request $request)
    {
        $totalOrders = Order::count();
        $totalRevenue = Order::where('status', 'paid')->sum('amount_paid');
        $activeBatches = Batch::whereIn('status', ['planned', 'in_progress'])->count();
        $totalCustomers = Customer::count();
        $lowStockItems = InventoryItem::whereColumn('quantity', '<=', 'min_stock')->get();
        
        // Ensure relation name is correct (orders model has no customer relation by default, but it has customer_id/customer_name). 
        // We will just return latest orders.
        $recentOrders = Order::latest()->take(5)->get();

        return response()->json([
            'metrics' => array_filter([
                'total_orders' => $totalOrders,
                'total_revenue' => \App\Support\Money::visible() ? $totalRevenue : null,
                'active_batches' => $activeBatches,
                'total_customers' => $totalCustomers,
            ], fn ($v) => $v !== null),
            'low_stock_items' => $lowStockItems,
            'recent_orders' => $recentOrders,
        ]);
    }
}
