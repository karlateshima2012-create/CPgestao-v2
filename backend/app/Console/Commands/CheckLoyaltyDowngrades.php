<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class CheckLoyaltyDowngrades extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:check-loyalty-downgrades';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Command description';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting loyalty downgrade check...');

        // Only process customers with a loyalty level > 1 (Level 1 is assume to be the lowest/Bronze)
        $customers = \App\Models\Customer::where('loyalty_level', '>', 1)->get();

        foreach ($customers as $customer) {
            $settings = \App\Models\LoyaltySetting::where('tenant_id', $customer->tenant_id)->first();
            if (!$settings || empty($settings->levels_config)) {
                continue;
            }

            // Current level index (0-based)
            $currentLevelIdx = $customer->loyalty_level - 1;
            
            // Check rules for the current level (e.g. if you are Diamante, check Diamante rule)
            $levelConfig = $settings->levels_config[$currentLevelIdx] ?? null;

            if ($levelConfig && isset($levelConfig['days_to_downgrade']) && $levelConfig['days_to_downgrade'] > 0) {
                $lastActivity = $customer->last_activity_at 
                    ? \Carbon\Carbon::parse($customer->last_activity_at)
                    : $customer->created_at;

                $daysInactive = $lastActivity->diffInDays(now());

                if ($daysInactive >= $levelConfig['days_to_downgrade']) {
                    $oldLevel = $customer->loyalty_level;
                    $newLevel = $oldLevel - 1;
                    
                    $customer->update([
                        'loyalty_level' => $newLevel
                    ]);

                    \Illuminate\Support\Facades\Log::info("Customer {$customer->id} ({$customer->name}) downgraded from level {$oldLevel} to {$newLevel} due to {$daysInactive} days of inactivity.");
                    $this->warn("Downgraded client: {$customer->name} (Tenant: {$customer->tenant_id}) From {$oldLevel} to {$newLevel}");
                }
            }
        }

        $this->info('Loyalty downgrade check finished.');
    }
}
