<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $query = Notification::latest();
        if ($request->has('user_id')) {
            $query->where('target_user_id', $request->user_id)
                  ->orWhereNull('target_user_id');
        }
        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'message' => 'required|string',
            'type' => 'required|string|max:50',
            'target_roles' => 'nullable|array',
            'target_user_id' => 'nullable|exists:users,id',
            'read_by' => 'nullable|array',
        ]);

        $notification = Notification::create($validated);
        return response()->json($notification, 201);
    }

    public function show(Notification $notification)
    {
        return response()->json($notification);
    }

    public function update(Request $request, Notification $notification)
    {
        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'message' => 'sometimes|string',
            'type' => 'sometimes|string|max:50',
            'target_roles' => 'nullable|array',
            'target_user_id' => 'nullable|exists:users,id',
            'read_by' => 'nullable|array',
        ]);

        $notification->update($validated);
        return response()->json($notification);
    }

    public function destroy(Notification $notification)
    {
        $notification->delete();
        return response()->json(null, 204);
    }
}
