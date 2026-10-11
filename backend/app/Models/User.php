<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'permissions',
        'avatar',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'permissions' => 'array',
            'is_owner' => 'boolean',
        ];
    }

    /**
     * Permissions are normally a JSON array, but some users were saved as a JSON string holding JSON
     * (double-encoded). Read both as an array so permission checks never crash.
     */
    protected function permissions(): \Illuminate\Database\Eloquent\Casts\Attribute
    {
        return \Illuminate\Database\Eloquent\Casts\Attribute::make(
            get: function ($value) {
                for ($i = 0; $i < 3 && is_string($value) && $value !== ''; $i++) {
                    $value = json_decode($value, true);
                }

                return is_array($value) ? $value : [];
            },
        );
    }

    protected static function booted(): void
    {
        // The owner account is always an admin and can never be deleted.
        static::saving(function (User $user) {
            if ($user->is_owner) {
                $user->role = 'admin';
            }
        });
        static::deleting(function (User $user) {
            if ($user->is_owner) {
                return false;
            }
        });
    }

    /** The owner always reads as admin, whatever the column holds. */
    protected function role(): \Illuminate\Database\Eloquent\Casts\Attribute
    {
        return \Illuminate\Database\Eloquent\Casts\Attribute::make(
            get: fn ($value, array $attributes) => !empty($attributes['is_owner']) ? 'admin' : $value,
        );
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->is_owner || $this->role === 'admin') {
            return true;
        }

        if (in_array($permission, $this->permissions ?? [])) {
            return true;
        }

        // Inheritance: write implies read
        if (str_ends_with($permission, '.read')) {
            $writePerm = str_replace('.read', '.write', $permission);
            if (in_array($writePerm, $this->permissions ?? [])) {
                return true;
            }
        }

        return false;
    }
}
