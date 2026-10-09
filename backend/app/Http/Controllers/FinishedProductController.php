<?php

namespace App\Http\Controllers;

use App\Models\FinishedProduct;
use App\Models\FinishedGoodsStock;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class FinishedProductController extends Controller
{
    public function index()
    {
        $products = FinishedProduct::with([
            'inputs.recipe:id,name',
            'materials.inventoryItem:id,name,type,unit',
            'components.component:id,name,type',
            'stock',
            'availableLots',
        ])->get();

        $this->attachCartonInfo($products);

        return response()->json($products);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'       => 'required|string|max:255',
            'type'       => 'required|in:piece,box',
            'unit_price' => 'required|numeric|min:0',
            'notes'      => 'nullable|string',
            'inputs'     => 'array',
            'inputs.*.recipe_id'    => 'required|exists:recipes,id',
            'inputs.*.kg_per_piece' => 'required|numeric|min:0',
            'materials'  => 'array',
            'materials.*.inventory_item_id' => 'required|exists:inventory_items,id',
            'materials.*.qty_per_piece'     => 'required|numeric|min:0',
            'components' => 'array',
            'components.*.component_id' => 'required|exists:finished_products,id',
            'components.*.qty_per_box'  => 'required|numeric|min:0',
        ]);

        $product = FinishedProduct::create([
            'name'       => $validated['name'],
            'type'       => $validated['type'],
            'unit_price' => $validated['unit_price'],
            'notes'      => $validated['notes'] ?? null,
        ]);

        foreach ($validated['inputs'] ?? [] as $input) {
            $product->inputs()->create($input);
        }
        foreach ($validated['materials'] ?? [] as $mat) {
            $product->materials()->create($mat);
        }
        foreach ($validated['components'] ?? [] as $comp) {
            $product->components()->create($comp);
        }

        // Initialise stock at zero
        FinishedGoodsStock::firstOrCreate(
            ['finished_product_id' => $product->id],
            ['quantity' => 0]
        );

        return response()->json($this->loadProduct($product->id), 201);
    }

    public function update(Request $request, FinishedProduct $finishedProduct)
    {
        $validated = $request->validate([
            'name'       => 'sometimes|string|max:255',
            'type'       => 'sometimes|in:piece,box',
            'unit_price' => 'sometimes|numeric|min:0',
            'notes'      => 'nullable|string',
            'inputs'     => 'array',
            'inputs.*.recipe_id'    => 'required|exists:recipes,id',
            'inputs.*.kg_per_piece' => 'required|numeric|min:0',
            'materials'  => 'array',
            'materials.*.inventory_item_id' => 'required|exists:inventory_items,id',
            'materials.*.qty_per_piece'     => 'required|numeric|min:0',
            'components' => 'array',
            'components.*.component_id' => 'required|exists:finished_products,id',
            'components.*.qty_per_box'  => 'required|numeric|min:0',
        ]);

        $finishedProduct->update(array_intersect_key($validated, array_flip(['name', 'type', 'unit_price', 'notes'])));

        if (array_key_exists('inputs', $validated)) {
            $finishedProduct->inputs()->delete();
            foreach ($validated['inputs'] as $input) {
                $finishedProduct->inputs()->create($input);
            }
        }
        if (array_key_exists('materials', $validated)) {
            $finishedProduct->materials()->delete();
            foreach ($validated['materials'] as $mat) {
                $finishedProduct->materials()->create($mat);
            }
        }
        if (array_key_exists('components', $validated)) {
            $finishedProduct->components()->delete();
            foreach ($validated['components'] as $comp) {
                $finishedProduct->components()->create($comp);
            }
        }

        return response()->json($this->loadProduct($finishedProduct->id));
    }

    public function destroy(FinishedProduct $finishedProduct)
    {
        $finishedProduct->delete();
        return response()->json(null, 204);
    }

    private function loadProduct(int $id): FinishedProduct
    {
        $product = FinishedProduct::with([
            'inputs.recipe:id,name',
            'materials.inventoryItem:id,name,type,unit',
            'components.component:id,name,type',
            'stock',
            'availableLots',
        ])->findOrFail($id);

        $this->attachCartonInfo(collect([$product]));

        return $product;
    }

    /**
     * For each piece product: the carton it is packed into ('carton' => size + sealed cartons in stock).
     * Lets the screens show "10 cartons + 3 loose" and know an order can open a carton.
     */
    private function attachCartonInfo($products): void
    {
        $rows = \App\Models\FinishedProductComponent::whereIn('component_id', $products->pluck('id'))
            ->orderBy('id')->get()->unique('component_id')->keyBy('component_id');
        $boxes = FinishedProduct::whereIn('id', $rows->pluck('finished_product_id'))->get()->keyBy('id');
        $sealed = \App\Models\FinishedGoodsLot::whereIn('finished_product_id', $boxes->keys())
            ->selectRaw('finished_product_id, SUM(qty_remaining) as qty')->groupBy('finished_product_id')
            ->pluck('qty', 'finished_product_id');

        foreach ($products as $p) {
            $row = $rows->get($p->id);
            $box = $row ? $boxes->get($row->finished_product_id) : null;
            $p->setAttribute('carton', $box ? [
                'box_id'       => $box->id,
                'box_name'     => $box->name,
                'qty_per_box'  => (float) $row->qty_per_box,
                'sealed'       => (float) ($sealed[$box->id] ?? 0),
            ] : null);
        }
    }

    public function uploadImage(Request $request, FinishedProduct $finishedProduct)
    {
        $request->validate(['image' => 'required|image|mimes:jpg,jpeg,png,webp|max:4096']);

        if ($finishedProduct->image_path) {
            Storage::disk('public')->delete($finishedProduct->image_path);
        }
        $finishedProduct->image_path = $request->file('image')->store('product-images', 'public');
        $finishedProduct->save();

        return response()->json($this->loadProduct($finishedProduct->id));
    }

    public function deleteImage(FinishedProduct $finishedProduct)
    {
        if ($finishedProduct->image_path) {
            Storage::disk('public')->delete($finishedProduct->image_path);
            $finishedProduct->image_path = null;
            $finishedProduct->save();
        }

        return response()->json($this->loadProduct($finishedProduct->id));
    }

    // Public on purpose: <img> tags cannot send the auth token, and product photos are not sensitive.
    public function showImage(FinishedProduct $finishedProduct)
    {
        abort_unless($finishedProduct->image_path && Storage::disk('public')->exists($finishedProduct->image_path), 404);

        return response()->file(Storage::disk('public')->path($finishedProduct->image_path), [
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }

    // Manual "open carton": sealed cartons become loose pieces (keeping the cartons' dates).
    public function openBox(Request $request, FinishedProduct $finishedProduct, \App\Services\FinishedStockService $stock)
    {
        abort_unless($finishedProduct->type === 'box', 422, 'Only a carton (box) product can be opened.');
        $validated = $request->validate(['count' => 'required|integer|min:1|max:1000']);

        $available = (int) floor($stock->available($finishedProduct->id));
        if ($validated['count'] > $available) {
            abort(422, "Only {$available} sealed carton(s) in stock.");
        }

        \Illuminate\Support\Facades\DB::transaction(fn () => $stock->openBox($finishedProduct, $validated['count'], null, 'Opened manually'));

        return response()->json($this->loadProduct($finishedProduct->id));
    }
}
