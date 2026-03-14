<?php

namespace App\Services;

use Intervention\Image\ImageManager;
use Intervention\Image\Drivers\Gd\Driver;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CustomerPhotoService
{
    protected $manager;

    public function __construct()
    {
        $this->manager = new ImageManager(new Driver());
    }

    /**
     * Process and save customer photo and its thumbnail.
     *
     * @param \Illuminate\Http\UploadedFile $file
     * @param string $customerId
     * @return string Path to the processed image
     */
    public function processAndSave($file, $customerId)
    {
        // Define paths
        $directory = 'clientes';
        $thumbDirectory = 'clientes/thumbs';
        
        // Ensure directories exist
        Storage::disk('public')->makeDirectory($directory);
        Storage::disk('public')->makeDirectory($thumbDirectory);

        $uniqueId = Str::random(6);
        $filename = "{$customerId}_{$uniqueId}.webp";
        $path = "{$directory}/{$filename}";
        $thumbPath = "{$thumbDirectory}/{$filename}";

        // Handle base64 or UploadedFile
        if (is_string($file)) {
            if (preg_match('/^data:image\/(\w+);base64,/', $file)) {
                $file = base64_decode(preg_replace('/^data:image\/(\w+);base64,/', '', $file));
            } elseif (is_string($file) && !str_starts_with($file, '/')) {
                // Check if it's already decoded string or missing header
                $decoded = base64_decode($file, true);
                if ($decoded !== false) $file = $decoded;
            }
        }

        try {
            // 1. Process Main Image (800x800, WEBP, central crop)
            $image = $this->manager->read($file);
            
            // Square crop central and resize using cover()
            $image->cover(800, 800); 
            
            // Convert to WebP and optimize
            $encoded = $image->encodeByExtension('webp', quality: 95);
            
            Storage::disk('public')->put($path, (string) $encoded);

            // 2. Process Thumbnail (150x150, WEBP)
            $thumb = $this->manager->read($file);
            $thumb->cover(150, 150);
            $thumbEncoded = $thumb->encodeByExtension('webp', quality: 85);
            
            Storage::disk('public')->put($thumbPath, (string) $thumbEncoded);

            return $path;
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Error processing/saving customer photo for {$customerId}: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Delete customer photo and its thumbnail.
     *
     * @param string|null $path
     * @return void
     */
    public function delete($path)
    {
        if (!$path) return;

        Storage::disk('public')->delete($path);
        
        // Delete thumb if exists
        $thumbPath = str_replace('clientes/', 'clientes/thumbs/', $path);
        Storage::disk('public')->delete($thumbPath);
    }
}
