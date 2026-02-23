<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

use App\Models\TenantTag;
use App\Models\Tenant;

class PopulateDefaultTagsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $tenantId;

    /**
     * Create a new job instance.
     */
    public function __construct($tenantId)
    {
        $this->tenantId = $tenantId;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $tenant = Tenant::find($this->tenantId);
        if (!$tenant) {
            return;
        }

        $defaultTags = [
            // Comportamento
            ['name' => 'Cliente Novo', 'category' => 'Comportamento', 'color' => 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'],
            ['name' => 'Cliente Recorrente', 'category' => 'Comportamento', 'color' => 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'],
            ['name' => 'Cliente Inativo', 'category' => 'Comportamento', 'color' => 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'],
            ['name' => 'Alto Ticket', 'category' => 'Comportamento', 'color' => 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'],
            ['name' => 'Baixo Ticket', 'category' => 'Comportamento', 'color' => 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'],
            ['name' => 'Compra Esporádica', 'category' => 'Comportamento', 'color' => 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800'],
            
            // Perfil
            ['name' => 'Conservador', 'category' => 'Perfil', 'color' => 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'],
            ['name' => 'Exigente', 'category' => 'Perfil', 'color' => 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'],
            ['name' => 'Sensível a preço', 'category' => 'Perfil', 'color' => 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'],
            ['name' => 'Decide rápido', 'category' => 'Perfil', 'color' => 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'],
            ['name' => 'Gosta de promoções', 'category' => 'Perfil', 'color' => 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800'],
            
            
            // Relacionamento
            ['name' => 'Indicador', 'category' => 'Relacionamento', 'color' => 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'],
            ['name' => 'Cliente estratégico', 'category' => 'Relacionamento', 'color' => 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'],
            ['name' => 'Parceiro', 'category' => 'Relacionamento', 'color' => 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800'],
        ];

        foreach ($defaultTags as $tagData) {
            $existing = TenantTag::where('tenant_id', $this->tenantId)
                ->where('name', $tagData['name'])
                ->first();

            if (!$existing) {
                TenantTag::create(array_merge($tagData, ['tenant_id' => $this->tenantId]));
            }
        }
    }
}
