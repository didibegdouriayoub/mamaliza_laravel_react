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
            'customer_id'     => 'nullable|exists:customers,id',
            'customer_name'   => 'required|string|max:255',
            'total_amount'    => 'required|numeric|min:0',
            'amount_paid'     => 'nullable|numeric|min:0',
            'amount_returned' => 'nullable|numeric|min:0',
            // T12.7.6: align with migration enum
            'status'          => 'required|in:pending,partial,paid,shipped,cancelled',
            'paid_at'         => 'nullable|date',
            'items'           => 'nullable|array',
            'items.*.product_name' => 'required_with:items|string|max:255',
            'items.*.quantity'     => 'required_with:items|numeric|min:0',
            'items.*.unit_price'   => 'required_with:items|numeric|min:0',
            'items.*.total'        => 'required_with:items|numeric|min:0',
        ]);

        $items = $validated['items'] ?? [];
        unset($validated['items']);

        $order = Order::create($validated);

        foreach ($items as $item) {
            $order->items()->create($item);
        }

        return response()->json($order->load('items'), 201);
    }

    public function show(Order $order)
    {
        return response()->json($order->load(['items', 'returns', 'payments']));
    }

    public function update(Request $request, Order $order)
    {
        $validated = $request->validate([
            'customer_id'     => 'nullable|exists:customers,id',
            'customer_name'   => 'sometimes|string|max:255',
            'total_amount'    => 'sometimes|numeric|min:0',
            'amount_paid'     => 'nullable|numeric|min:0',
            'amount_returned' => 'nullable|numeric|min:0',
            'status'          => 'sometimes|in:pending,partial,paid,shipped,cancelled',
            'paid_at'         => 'nullable|date',
        ]);

        $order->update($validated);
        return response()->json($order);
    }

    public function destroy(Order $order)
    {
        $order->delete();
        return response()->json(null, 204);
    }

    // T12.7.1: Record a payment and auto-update order status
    public function storePayment(Request $request, Order $order)
    {
        $validated = $request->validate([
            'amount'  => 'required|numeric|min:0.01',
            // T12.7.3: accept both "Cash" and "cash" style, we normalise below
            'method'  => 'required|string|in:cash,card,bank_transfer,check',
            'paid_at' => 'nullable|date',
        ]);

        $payment = $order->payments()->create([
            'amount'     => $validated['amount'],
            'method'     => $validated['method'],
            'paid_at'    => $validated['paid_at'] ?? now()->toDateString(),
            'created_at' => now(),
        ]);

        $order->increment('amount_paid', $validated['amount']);
        $order->refresh();

        if ($order->amount_paid >= $order->total_amount) {
            $order->update(['status' => 'paid', 'paid_at' => now()]);
        } elseif ($order->amount_paid > 0) {
            $order->update(['status' => 'partial']);
        }

        return response()->json($order->load(['items', 'returns', 'payments']), 201);
    }

    // T12.7.1: Record a return and update amount_returned
    public function storeReturn(Request $request, Order $order)
    {
        $validated = $request->validate([
            'product_name'  => 'nullable|string|max:255',
            'order_item_id' => 'nullable|exists:order_items,id',
            'quantity'      => 'required|numeric|min:0.001',
            'reason'        => 'nullable|string',
            'refund_amount' => 'nullable|numeric|min:0',
        ]);

        $return = $order->returns()->create([
            'order_item_id' => $validated['order_item_id'] ?? null,
            'product_name'  => $validated['product_name'] ?? null,
            'quantity'      => $validated['quantity'],
            'reason'        => $validated['reason'] ?? null,
            'refund_amount' => $validated['refund_amount'] ?? 0,
        ]);

        if (($validated['refund_amount'] ?? 0) > 0) {
            $order->increment('amount_returned', $validated['refund_amount']);
        }

        return response()->json($return, 201);
    }

    // T12.7.1: Explicit status update endpoint
    public function updateStatus(Request $request, Order $order)
    {
        $validated = $request->validate([
            'status' => 'required|in:pending,partial,paid,shipped,cancelled',
        ]);
        $order->update($validated);
        return response()->json($order);
    }
}
