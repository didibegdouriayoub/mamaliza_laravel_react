<?php

namespace App\Http\Controllers;

use App\Models\InventoryHistory;
use App\Models\InventoryItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PackagingCarton;
use App\Services\DocumentNumberService;
use App\Services\FinishedStockService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    public function index()
    {
        return response()->json(Order::with('items', 'returns', 'payments')->latest()->get());
    }

    /**
     * A user without the money permission cannot send prices or payments: price every line from the catalog
     * (carton / piece / inventory item), and start the document unpaid.
     */
    private function priceFromCatalog(Request $request): void
    {
        if (\App\Support\Money::visible()) {
            return;
        }
        $total = 0.0;
        $items = array_map(function ($i) use (&$total) {
            $price = 0.0;
            if (!empty($i['finished_product_id'])) {
                $price = (float) \App\Models\FinishedProduct::find($i['finished_product_id'])?->unit_price;
            } elseif (!empty($i['inventory_item_id'])) {
                $price = (float) \App\Models\InventoryItem::find($i['inventory_item_id'])?->price;
            }
            $i['unit_price'] = $price;
            $i['total'] = round($price * (float) ($i['quantity'] ?? 0), 2);
            $total += $i['total'];

            return $i;
        }, (array) $request->input('items', []));

        $request->merge(['items' => $items, 'total_amount' => round($total, 2), 'amount_paid' => 0, 'amount_returned' => 0, 'status' => 'pending']);
    }

    public function store(Request $request, FinishedStockService $stockService, DocumentNumberService $numbers)
    {
        $this->priceFromCatalog($request);
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
            'items.*.lot_allocations'          => 'nullable|array',
            'items.*.lot_allocations.*.lot_id' => 'required|integer|exists:finished_goods_lots,id',
            'items.*.lot_allocations.*.qty'    => 'required|numeric|gt:0',
        ]);

        $items = $validated['items'] ?? [];
        unset($validated['items']);

        $stockWarnings = [];
        $cartonsOpened = [];

        // Only two documents exist: devis and facture (the old "order" is a facture)
        $validated['document_type'] = ($validated['document_type'] ?? 'facture') === 'devis' ? 'devis' : 'facture';

        $order = DB::transaction(function () use ($validated, $items, &$stockWarnings, &$cartonsOpened, $stockService, $numbers) {
            $validated['doc_number'] = $numbers->next($validated['document_type']);
            $order = Order::create($validated);
            $isDevis = $validated['document_type'] === 'devis';

            foreach ($items as $itemData) {
                $allocations = $itemData['lot_allocations'] ?? [];
                unset($itemData['lot_allocations']);

                /** @var OrderItem $orderItem */
                $orderItem = $order->items()->create($itemData);

                // Lots chosen by the seller: take exactly those (the quantity must match)
                if ($allocations && $orderItem->finished_product_id && !$isDevis) {
                    $sum = array_sum(array_column($allocations, 'qty'));
                    if (abs($sum - (float) $orderItem->quantity) > 1e-6) {
                        throw ValidationException::withMessages(['items' => "{$orderItem->product_name}: the lots add up to {$sum}, not {$orderItem->quantity}."]);
                    }
                    $stockService->deductFromChosenLots($orderItem->finished_product_id, $allocations, $order->id, $orderItem->id);
                    continue;
                }

                // Deduct from finished goods stock when a finished product is linked (not for devis)
                if ($orderItem->finished_product_id && !$isDevis) {
                    $qty = (float) $orderItem->quantity;
                    // loose pieces first; sealed cartons are opened when the pieces are not enough
                    [$taken, $opened] = $stockService->deductForOrder($orderItem->finished_product_id, $qty, $order->id, $orderItem->id);
                    if ($opened > 0) {
                        $cartonsOpened[] = ['finished_product_id' => $orderItem->finished_product_id, 'name' => $orderItem->product_name, 'cartons' => $opened];
                    }
                    if ($taken < $qty) {
                        $stockWarnings[] = [
                            'finished_product_id' => $orderItem->finished_product_id,
                            'name'                => $orderItem->product_name,
                            'requested'           => $qty,
                            'available'           => $taken,
                        ];
                    }
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
        return response()->json(array_merge($response->toArray(), ['stock_warnings' => $stockWarnings, 'cartons_opened' => $cartonsOpened]), 201);
    }

    /** Turn a devis into a facture: same lines, stock is deducted now, and the devis points to the facture. */
    public function convert(Order $order, FinishedStockService $stockService, DocumentNumberService $numbers)
    {
        if ($order->document_type !== 'devis') {
            return response()->json(['message' => 'Only a devis can be converted to a facture.'], 422);
        }
        if ($order->converted_to_id) {
            return response()->json(['message' => 'This devis was already converted to a facture.'], 422);
        }

        $order->load('items');
        $payload = [
            'customer_id'     => $order->customer_id,
            'customer_name'   => $order->customer_name,
            'total_amount'    => $order->total_amount,
            'amount_paid'     => 0,
            'amount_returned' => 0,
            'status'          => 'pending',
            'document_type'   => 'facture',
            'items'           => $order->items->map(fn ($i) => [
                'product_name'        => $i->product_name,
                'quantity'            => $i->quantity,
                'unit'                => $i->unit,
                'carton_id'           => $i->carton_id,
                'inventory_item_id'   => $i->inventory_item_id,
                'finished_product_id' => $i->finished_product_id,
                'unit_price'          => $i->unit_price,
                'total'               => $i->total,
            ])->all(),
        ];

        return DB::transaction(function () use ($order, $payload, $stockService, $numbers) {
            $response = $this->store(new Request($payload), $stockService, $numbers);
            $order->update(['converted_to_id' => $response->getData(true)['id']]);

            return $response;
        });
    }

    public function show(Order $order)
    {
        return response()->json($order->load(['items', 'returns', 'payments']));
    }

    public function update(Request $request, Order $order)
    {
        if (!\App\Support\Money::visible()) {
            $request->request->remove('total_amount');
            $request->request->remove('amount_paid');
            $request->request->remove('amount_returned');
        }
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

    public function destroy(Order $order, FinishedStockService $stockService)
    {
        // A facture settled from a worker's tournée never left the fridge itself: deleting it hands the goods
        // back to the tournée (its deliveries cascade), and only while that tournée is still open.
        if ($order->tournee_id) {
            $tournee = \App\Models\Tournee::find($order->tournee_id);
            if ($tournee && $tournee->status === 'closed') {
                throw ValidationException::withMessages(['order' => 'This facture belongs to a closed tournée and cannot be deleted.']);
            }
            $order->delete();
            return response()->json(null, 204);
        }

        DB::transaction(function () use ($order, $stockService) {
            $stockService->restoreForOrder($order->load('items'));
            $order->delete();
        });
        return response()->json(null, 204);
    }

    // T12.7.1: Record a payment and auto-update order status
    public function storePayment(Request $request, Order $order)
    {
        abort_unless(\App\Support\Money::visible(), 403, 'Recording a payment needs the money permission.');
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
    public function storeReturn(Request $request, Order $order, FinishedStockService $stockService)
    {
        if (!\App\Support\Money::visible()) {
            $request->merge(['refund_amount' => 0]);
        }
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

        $return = DB::transaction(function () use ($order, $validated, $orderItem, $unit, $cartonId, $piecesReturned, $targetInventoryItemId, $finishedProductId, $stockService) {
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
                $stockService->restoreForOrderItem($finishedProductId, (float) $piecesReturned, $order->id, $orderItem?->id, $validated['reason'] ?? null);
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
