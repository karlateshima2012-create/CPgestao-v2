<?php

namespace App\Http\Responses;

use Illuminate\Http\JsonResponse;

class ApiResponse
{
    /**
     * Standard success response.
     */
    public static function ok($data = null, $message = null): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'data' => $data,
            'message' => $message,
        ], 200);
    }

    /**
     * Standard error response.
     */
    public static function error(string $message, string $code = 'ERROR', int $status = 400, $data = null): JsonResponse
    {
        return response()->json([
            'ok' => false,
            'message' => $message,
            'code' => $code,
            'data' => $data,
        ], $status);
    }
}
