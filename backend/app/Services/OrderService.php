<?php

namespace App\Services;

use App\Models\Order;

class OrderService
{
    /**
     * Auto-update the order status based on payments
     */
    public function updateStatusOnPayment(Order $order, float $amountPaid)
    {
        $order->amount_paid += $amountPaid;

        if ($order->amount_paid >= $order->total_amount) {
            $order->status = 'paid';
            $order->paid_at = now();
        }

        $order->save();
        return $order;
    }
}
