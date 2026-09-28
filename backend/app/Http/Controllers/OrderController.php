<?php

namespace App\Http\Controllers;

use App\Models\FinishedGoodsStock;
use App\Models\InventoryHistory;
use App\Models\InventoryItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PackagingCarton;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
            'document_type'   => 'nullable|in:order,facture,devis',
            'paid_at'         => 'nullable|date',
            'items'           => 'nullable|array',
            'items.*.product_name'         => 'required_with:items|string|max:255',
            'items.*.quantity'             => 'required_with:items|numeric|min:0',
            'items.*.unit'                 => 'nullable|in:piece,carton',
            'items.*.carton_id'            => 'nullable|exists:packaging_cartons,id',
            'items.*.inventory_item_id'    => 'nullable|exists:inventory_items,id',
            'items.*.finished_product_id'  => 'nullable|exists:finished_products,id',
            'items.*.unit_price'           => 'required_with:items|numeric|min:0',
            'items.*.total'                => 'required_with:items|numeric|min:0',
        ]);

        $items = $validated['items'] ?? [];
        unset($validated['items']);

        $stockWarnings = [];

        $order = DB::transaction(function () use ($validated, $items, &$stockWarnings) {
            $order = Order::create($validated);
            $isDevis = ($validated['document_type'] ?? 'order') === 'devis';

            foreach ($items as $itemData) {
                /** @var OrderItem $orderItem */
                $orderItem = $order->items()->create($itemData);

                // Deduct from finished goods stock when a finished product is linked (not for devis)
                if ($orderItem->finished_product_id && !$isDevis) {
                    $stock = FinishedGoodsStock::firstOrCreate(
                        ['finished_product_id' => $orderItem->finished_product_id],
                        ['quantity' => 0]
                    );
                    $qty = (float) $orderItem->quantity;
                    if ($qty > $stock->quantity) {
                        $stockWarnings[] = [
                            'finished_product_id' => $orderItem->finished_product_id,
                            'name'                => $orderItem->product_name,
                            'requested'           => $qty,
                            'available'           => $stock->quantity,
                        ];
                    }
                    $stock->quantity = $stock->quantity - $qty; // allow negative (oversell)
                    $stock->save();
                    continue;
                }

                if ($orderItem->finished_product_id) {
                    continue; // devis — skip stock, skip inventory
                }

                if (!$orderItem->inventory_item_id) {
                    continue;
                }

                $inventoryItem = InventoryItem::find($orderItem->inventory_item_id);
                if (!$inventoryItem) {
                    continue;
                }

                $piecesSold = $orderItem->piecesQuantity();
                $before = $inventoryItem->quantity;

                if ($piecesSold > $before) {
                    $stockWarnings[] = [
                        'inventory_item_id' => $inventoryItem->id,
                        'name'              => $inventoryItem->name,
                        'requested'         => $piecesSold,
                        'available'         => $before,
                    ];
                }

                $inventoryItem->quantity = $before - $piecesSold;
                $inventoryItem->save();

                InventoryHistory::create([
                    'item_id'    => $inventoryItem->id,
                    'field'      => 'quantity',
                    'old_value'  => (string) $before,
                    'new_value'  => (string) $inventoryItem->quantity,
                    'changed_by' => auth()->id(),
                ]);
            }

            return $order;
        });

        $response = $order->load('items');
        return response()->json(array_merge($response->toArray(), ['stock_warnings' => $stockWarnings]), 201);
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
            'product_name'   => 'nullable|string|max:255',
            'order_item_id'  => 'nullable|exists:order_items,id',
            'quantity'       => 'required|numeric|min:0.001',
            'unit'           => 'nullable|in:piece,carton',
            'carton_id'      => 'nullable|exists:packaging_cartons,id',
            'reason'               => 'nullable|string',
            'refund_amount'        => 'nullable|numeric|min:0',
            'disposition'          => 'nullable|in:restock,reemploi,perte',
            'target_inventory_item_id'  => 'required_if:disposition,reemploi|nullable|exists:inventory_items,id',
            'finished_product_id'  => 'nullable|exists:finished_products,id',
        ]);

        $orderItem = isset($validated['order_item_id']) ? OrderItem::find($validated['order_item_id']) : null;

        $unit = $validated['unit'] ?? $orderItem?->unit ?? 'piece';
        $cartonId = $validated['carton_id'] ?? $orderItem?->carton_id;
        $piecesPerCarton = $cartonId ? PackagingCarton::find($cartonId)?->pieces_per_carton : null;
        $piecesReturned = ($unit === 'carton' && $piecesPerCarton)
            ? $validated['quantity'] * $piecesPerCarton
            : $validated['quantity'];

        $targetInventoryItemId = $validated['target_inventory_item_id'] ?? $orderItem?->inventory_item_id;

        $finishedProductId = $validated['finished_product_id'] ?? $orderItem?->finished_product_id ?? null;

        $return = DB::transaction(function () use ($order, $validated, $orderItem, $unit, $cartonId, $piecesReturned, $targetInventoryItemId, $finishedProductId) {
            $return = $order->returns()->create([
                'order_item_id'       => $orderItem?->id,
                'product_name'        => $validated['product_name'] ?? null,
                'quantity'            => $validated['quantity'],
                'unit'                => $unit,
                'carton_id'           => $cartonId,
                'inventory_item_id'   => $targetInventoryItemId,
                'finished_product_id' => $finishedProductId,
                'reason'              => $validated['reason'] ?? null,
                'disposition'         => $validated['disposition'] ?? null,
                'refund_amount'       => $validated['refund_amount'] ?? 0,
            ]);

            if (($validated['refund_amount'] ?? 0) > 0) {
                $order->increment('amount_returned', $validated['refund_amount']);
            }

            $disposition = $validated['disposition'] ?? null;

            // Restore finished goods stock when restock disposition + finished product
            if ($disposition === 'restock' && $finishedProductId) {
                $stock = FinishedGoodsStock::firstOrCreate(
                    ['finished_product_id' => $finishedProductId],
                    ['quantity' => 0]
                );
                $stock->increment('quantity', $piecesReturned);
            } elseif (in_array($disposition, ['restock', 'reemploi'], true) && $targetInventoryItemId) {
                $inventoryItem = InventoryItem::find($targetInventoryItemId);
                if ($inventoryItem) {
                    $before = $inventoryItem->quantity;
                    $inventoryItem->quantity = $before + $piecesReturned;
                    $inventoryItem->save();

                    InventoryHistory::create([
                        'item_id'    => $inventoryItem->id,
                        'field'      => 'quantity',
                        'old_value'  => (string) $before,
                        'new_value'  => (string) $inventoryItem->quantity,
                        'changed_by' => auth()->id(),
                    ]);
                }
            }
            // disposition 'perte' (or none): no stock effect

            return $return;
        });

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
