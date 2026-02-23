<?php
require __DIR__ . '/backend/vendor/autoload.php';

use App\Utils\PhoneHelper;

$testCases = [
    '090-1111-2222' => '09011112222',
    '9011112222'    => '09011112222',
    '80111889855'   => '080111889855', // Logic for 11 digits starting with 8...
    '080-1111-2222' => '08011112222',
    '819011112222'  => '09011112222',
    '+81 90-1111-2222' => '09011112222',
    '03-1111-2222'  => '0311112222',
];

foreach ($testCases as $input => $expected) {
    $result = PhoneHelper::normalize($input);
    echo "Input: $input | Expected: $expected | Result: $result | " . ($result === $expected ? "✅" : "❌") . "\n";
}
