<?php

namespace App\Services;

use App\Models\Notification;

class NotificationService
{
    /**
     * Send notification to specific roles
     */
    public function sendToRole(string $role, string $title, string $message, string $type = 'info')
    {
        return Notification::create([
            'title' => $title,
            'message' => $message,
            'type' => $type,
            'target_roles' => [$role],
        ]);
    }

    /**
     * Send notification to a specific user
     */
    public function sendToUser(int $userId, string $title, string $message, string $type = 'info')
    {
        return Notification::create([
            'title' => $title,
            'message' => $message,
            'type' => $type,
            'target_user_id' => $userId,
        ]);
    }
}
