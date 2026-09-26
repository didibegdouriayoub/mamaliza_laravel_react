<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        \App\Models\User::updateOrCreate(
            ['email' => 'admin@mamalia.com'],
            [
                'name'        => 'Admin',
                'password'    => Hash::make('Ayoue123&'),
                'role'        => 'admin',
                'permissions' => json_encode([]),
            ]
        );

        $this->call(PackagingMaterialsSeeder::class);
    }
}
