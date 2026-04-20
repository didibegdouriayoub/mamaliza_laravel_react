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
    // Accepts one or more permission args (Laravel splits "a,b,c" into separate args).
    // Passes if the user has ANY of the listed permissions.
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();

        if (!$user || !collect($permissions)->contains(fn($p) => $user->hasPermission(trim($p)))) {
            return response()->json([
                'message' => 'Unauthorized: Missing permission ' . implode(' or ', $permissions)
            ], 403);
        }

        return $next($request);
    }
}
