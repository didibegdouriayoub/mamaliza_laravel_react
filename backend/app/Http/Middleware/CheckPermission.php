<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermission
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    // Accepts comma-separated permissions: passes if the user has ANY of them.
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = $request->user();

        $any = array_map('trim', explode(',', $permission));

        if (!$user || !collect($any)->contains(fn($p) => $user->hasPermission($p))) {
            return response()->json([
                'message' => 'Unauthorized: Missing permission ' . $permission
            ], 403);
        }

        return $next($request);
    }
}
