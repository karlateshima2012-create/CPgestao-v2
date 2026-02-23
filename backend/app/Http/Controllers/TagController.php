<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\TenantTag;

class TagController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $tags = TenantTag::where('tenant_id', $tenantId)->get();
        return response()->json($tags);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'color' => 'required|string|max:255',
            'category' => 'required|string|max:100',
        ]);

        $tenantId = $request->user()->tenant_id;

        // Ensure no duplicate name inside the same tenant
        $existing = TenantTag::where('tenant_id', $tenantId)
            ->where('name', $request->name)
            ->first();

        if ($existing) {
            return response()->json(['error' => 'A tag with this name already exists.'], 400);
        }

        $tag = TenantTag::create([
            'tenant_id' => $tenantId,
            'name' => $request->name,
            'color' => $request->color,
            'category' => $request->category,
        ]);

        return response()->json($tag, 201);
    }

    public function destroy(Request $request, $id)
    {
        $tenantId = $request->user()->tenant_id;
        $tag = TenantTag::where('tenant_id', $tenantId)->where('id', $id)->firstOrFail();
        
        $tag->delete();
        return response()->json(['message' => 'Tag deleted successfully']);
    }
}
