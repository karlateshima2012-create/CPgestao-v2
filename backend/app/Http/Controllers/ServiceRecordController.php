<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\ServiceRecord;
use App\Models\Customer;
use App\Http\Responses\ApiResponse;
use Illuminate\Support\Facades\DB;

class ServiceRecordController extends Controller
{
    public function index(Request $request, $customerId)
    {
        $tenant = $request->user()->tenant;
        $customer = Customer::where('tenant_id', $tenant->id)->findOrFail($customerId);

        $records = ServiceRecord::where('tenant_id', $tenant->id)
            ->where('customer_id', $customer->id)
            ->orderBy('service_date', 'desc')
            ->paginate(10);

        return ApiResponse::ok($records);
    }

    public function store(Request $request, $customerId)
    {
        $tenant = $request->user()->tenant;
        $customer = Customer::where('tenant_id', $tenant->id)->findOrFail($customerId);

        $validated = $request->validate([
            'service_name' => 'required|string|max:255',
            'amount' => 'required|numeric|min:0',
            'payment_method' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
            'service_date' => 'required|date',
        ]);

        return DB::transaction(function () use ($validated, $tenant, $customer) {
            $record = ServiceRecord::create([
                'tenant_id' => $tenant->id,
                'customer_id' => $customer->id,
                'service_name' => $validated['service_name'],
                'amount' => $validated['amount'],
                'payment_method' => $validated['payment_method'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'service_date' => $validated['service_date'],
            ]);

            // Update Customer CRM totals
            $customer->total_spent += $validated['amount'];
            $customer->attendance_count += 1;
            
            if ($customer->attendance_count > 0) {
                $customer->average_ticket = $customer->total_spent / $customer->attendance_count;
            }

            $customer->last_activity_at = max($customer->last_activity_at, $validated['service_date']);
            $customer->save();

            return ApiResponse::ok($record, 'Registro de atendimento adicionado com sucesso.');
        });
    }
}
