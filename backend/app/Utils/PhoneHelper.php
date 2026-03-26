<?php

namespace App\Utils;

class PhoneHelper
{
    /**
     * Normalize a phone number to digits only.
     * 
     * @param string|null $phone
     * @return string
     */
    public static function normalize(?string $phone): string
    {
        if (!$phone) return '';
        
        // Remove all non-digits
        $digits = preg_replace('/\D/', '', $phone);
        
        if (!$digits) return '';
        
        return $digits;
    }

    /**
     * Format a phone for display (optional/future)
     */
    public static function format(?string $phone): string
    {
        if (!$phone) return '';
        $normalized = self::normalize($phone);
        
        if (strlen($normalized) === 11) {
             return substr($normalized, 0, 3) . '-' . substr($normalized, 3, 4) . '-' . substr($normalized, 7);
        }
        
        return $phone;
    }
}
