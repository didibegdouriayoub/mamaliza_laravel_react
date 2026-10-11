<?php

namespace App\Support;

/**
 * Money visibility: a signed-in user sees prices, costs, totals and payments only with `money.read`.
 * Code running without a user (commands, seeders, queues) is not restricted.
 */
class Money
{
    public const PERMISSION = 'money.read';

    public static function visible(): bool
    {
        $user = auth()->user();

        return !$user || $user->hasPermission(self::PERMISSION);
    }
}
