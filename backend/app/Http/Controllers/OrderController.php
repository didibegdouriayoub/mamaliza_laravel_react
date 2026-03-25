<?php

namespace App\Http\Controllers;

use App\Models\Order;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function index()
    {
        return response()->json(Order::with('items', 'returns', 'payments')->latest()->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'customer_id' => 'nullable|exists:customers,id',
            'customer_name' => 'required|string|max:255',
            'total_amount' => 'required|numeric|min:0',
            'amount_paid' => 'nullable|numeric|min:0',
            'amount_returned' => 'nullable|numeric|min:0',
            'status' => 'required|in:pending,paid,cancelled,completed',
            'paid_at' => 'nullable|date',
        ]);

        $order = Order::create($validated);
        return response()->json($order, 201);
    }

    public function show(Order $order)
    {
        return response()->json($order->load(['items', 'returns', 'payments']));
    }

    public function update(Request $request, Order $order)
    {
        $validated = $request->validate([
            'customer_id' => 'nullable|exists:customers,id',
            'customer_name' => 'sometimes|string|max:255',
            'total_amount' => 'sometimes|numeric|min:0',
            'amount_paid' => 'nullable|numeric|min:0',
            'amount_returned' => 'nullable|numeric|min:0',
            'status' => 'sometimes|in:pending,paid,cancelled,completed',
            'paid_at' => 'nullable|date',
        ]);

        $order->update($validated);
        return response()->json($order);
    }

    public function destroy(Order $order)
    {
        $order->delete();
        return response()->json(null, 204);
    }
}
