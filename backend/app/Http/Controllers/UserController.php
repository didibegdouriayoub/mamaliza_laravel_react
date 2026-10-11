<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index()
    {
        return response()->json(User::latest()->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:6',
            'role' => 'required|in:admin,supervisor,operator',
            'permissions' => 'nullable|array',
        ]);

        $validated['password'] = Hash::make($validated['password']);
        if (!isset($validated['permissions'])) {
            $validated['permissions'] = [];
        }

        $user = User::create($validated);
        return response()->json($user, 201);
    }

    public function show(User $user)
    {
        return response()->json($user);
    }

    public function update(Request $request, User $user)
    {
        // The owner account keeps its role, access and email: only the owner may change name or password.
        if ($user->is_owner) {
            abort_unless($request->user()?->id === $user->id, 403, 'The owner account cannot be changed.');
            $request->request->remove('role');
            $request->request->remove('permissions');
            $request->request->remove('email');
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|string|email|max:255|unique:users,email,' . $user->id,
            'password' => 'sometimes|string|min:6',
            'role' => 'sometimes|in:admin,supervisor,operator',
            'permissions' => 'nullable|array',
        ]);

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $user->update($validated);
        return response()->json($user);
    }

    public function destroy(User $user)
    {
        abort_if($user->is_owner, 403, 'The owner account cannot be deleted.');

        $user->delete();
        return response()->json(null, 204);
    }
}
