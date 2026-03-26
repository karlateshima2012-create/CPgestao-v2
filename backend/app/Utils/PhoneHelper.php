<?php

namespace App\Utils;

class PhoneHelper
{
    /**
     * Normalize phone number:
     * - Removes all non-digit characters.
     * - Handles Japan prefixes if necessary (0 to 81).
     * - Ensures a consistent format for storage and lookup.
     */
    public static function normalize(?string $phone): string
    {
        if (!$phone) return '';
        
        // 1. Remover todos os caracteres não numéricos
        $normalized = preg_replace('/\D/', '', $phone);

        // 2. Padronização para o formato do Japão (forçar 090/080/070)
        // Se começar com 81 e tiver 12 ou 13 dígitos
        if (str_starts_with($normalized, '81') && strlen($normalized) >= 11) {
            $normalized = '0' . substr($normalized, 2);
        }

        // Remover qualquer zero a mais acidental no início (ex: 0081...)
        $normalized = ltrim($normalized, '0');
        if (!empty($normalized)) {
            $normalized = '0' . $normalized;
        }

        return $normalized;
    }

}
