<?php

namespace App\Services;

use App\Models\QrToken;
use Illuminate\Support\Str;
use Exception;

class QrTokenService
{
    /**
     * Generate a unique token for a tenant.
     */
    public function generateToken(string $tenantId): string
    {
        $token = Str::random(32);
        
        QrToken::create([
            'tenant_id' => $tenantId,
            'token' => $token,
            'used' => false,
        ]);

        return $token;
    }

    /**
     * Validate and consume a token.
     */
    public function consumeToken(string $token, string $tenantId): QrToken
    {
        $qrToken = QrToken::where('token', $token)
            ->where('tenant_id', $tenantId)
            ->first();

        if (!$qrToken) {
            throw new Exception("Token inválido.");
        }

        if ($qrToken->used) {
            throw new Exception("Este QR Code já foi utilizado.");
        }

        $qrToken->update([
            'used' => true,
            'used_at' => now(),
        ]);

        return $qrToken;
    }

    /**
     * Check if a token is valid without consuming it.
     */
    public function isValid(string $token, string $tenantId): bool
    {
        return QrToken::where('token', $token)
            ->where('tenant_id', $tenantId)
            ->where('used', false)
            ->exists();
    }
}
