<?php

namespace App\Utils;

class Luhn
{
    /**
     * Generate a numeric string of length N that satisfies the Luhn algorithm.
     */
    public static function generate(int $length = 16): string
    {
        $number = '';
        for ($i = 0; $i < $length - 1; $i++) {
            $number .= mt_rand(0, 9);
        }

        return $number . self::calculateCheckDigit($number);
    }

    /**
     * Validate if a numeric string satisfies the Luhn algorithm.
     */
    public static function validate(string $number): bool
    {
        if (!ctype_digit($number)) {
            return false;
        }

        $sum = 0;
        $numDigits = strlen($number);
        $parity = $numDigits % 2;

        for ($i = 0; $i < $numDigits; $i++) {
            $digit = (int) $number[$i];
            
            if ($i % 2 === $parity) {
                $digit *= 2;
                if ($digit > 9) {
                    $digit -= 9;
                }
            }
            
            $sum += $digit;
        }

        return ($sum % 10 === 0);
    }

    /**
     * Calculate the check digit for a numeric string.
     */
    private static function calculateCheckDigit(string $partialNumber): int
    {
        $sum = 0;
        $numDigits = strlen($partialNumber);
        $parity = ($numDigits + 1) % 2;

        for ($i = 0; $i < $numDigits; $i++) {
            $digit = (int) $partialNumber[$i];
            
            if ($i % 2 === $parity) {
                $digit *= 2;
                if ($digit > 9) {
                    $digit -= 9;
                }
            }
            
            $sum += $digit;
        }

        $checkDigit = (10 - ($sum % 10)) % 10;
        
        return $checkDigit;
    }
}
