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
    public static function normalize(string $phone): string
    {
        // 1. Remover todos os caracteres não numéricos
        $normalized = preg_replace('/\D/', '', $phone);

        // 2. Tratar prefixo internacional do Japão (81)
        // Se começar com 81 e tiver 12 dígitos (81 + 90 + 8 dígitos)
        if (str_starts_with($normalized, '81') && (strlen($normalized) === 12 || strlen($normalized) === 11)) {
            $normalized = '0' . substr($normalized, 2);
        }

        // 3. Adicionar o zero inicial se foi omitido (comum no Japão)
        // Prefixos móveis comuns: 90, 80, 70 e IP 50
        if (strlen($normalized) === 10) {
            $prefix = substr($normalized, 0, 2);
            if (in_array($prefix, ['90', '80', '70', '50'])) {
                $normalized = '0' . $normalized;
            }
        }

        return $normalized;
    }
}
