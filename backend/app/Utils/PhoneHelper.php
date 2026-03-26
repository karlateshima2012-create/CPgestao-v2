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

        // 2. Tratar prefixo 81 (Japão) -> Troca 81 por 0
        if (str_starts_with($normalized, '81') && strlen($normalized) >= 11) {
             // 819012345678 -> 9012345678
             $normalized = substr($normalized, 2);
        }

        // 3. Garantir UM ÚNICO zero no início (Padrão Japão 090, 080, 070, 050)
        // Remove todos os zeros à esquerda e recoloca apenas um
        $normalized = ltrim($normalized, '0');
        if (!empty($normalized)) {
            $normalized = '0' . $normalized;
        }

        return $normalized;
    }


}
