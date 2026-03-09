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
        // Se começar com 81 e tiver no mínimo 11 dígitos
        if (str_starts_with($normalized, '81') && strlen($normalized) >= 11) {
            // Se o formato for 81-0-90... (com zero a mais)
            if (str_starts_with(substr($normalized, 2), '0')) {
                $normalized = substr($normalized, 2);
            } else {
                // Formato padrão 81-90... -> 090...
                $normalized = '0' . substr($normalized, 2);
            }
        }

        // 3. Adicionar o zero inicial se foi omitido em números de 10 dígitos (comum no Japão)
        if (strlen($normalized) === 10) {
            $prefix = substr($normalized, 0, 2);
            if (in_array($prefix, ['90', '80', '70', '50'])) {
                $normalized = '0' . $normalized;
            }
        }

        return $normalized;
    }
}
