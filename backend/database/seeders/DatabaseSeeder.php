<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $email    = env('ADMIN_EMAIL', 'admin@mamalia.com');
        $password = env('ADMIN_PASSWORD', 'changeme');

        \App\Models\User::updateOrCreate(
            ['email' => $email],
            [
                'name'        => 'Admin',
                'password'    => Hash::make($password),
                'role'        => 'admin',
                'permissions' => json_encode([]),
            ]
        );

        $this->call(PackagingMaterialsSeeder::class);
    }
}
