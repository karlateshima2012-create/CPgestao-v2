<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class DowngradeInactiveCustomers extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'loyalty:downgrade';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Downgrade customers loyalty level based on levels_config inactivity rules';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info("Starting customer downgrade process...");

        // Fetch tenants that have loyalty settings and levels config
        $settings = \App\Models\LoyaltySetting::whereNotNull('levels_config')->get();

        foreach ($settings as $setting) {
            $levelsConfig = $setting->levels_config;
            if (!is_array($levelsConfig)) continue;

            $tenantId = $setting->tenant_id;

            // Fetch customers for this tenant
            // We only care about customers who have a loyalty level > 1 (0 is entry)
            // or we evaluate against the indexes of levelsConfig
            
            // Note: levels_config format assumption:
            // [
            //   0 => ['name' => 'Bronze', 'goal' => 50, 'reward' => '...', 'days_to_downgrade' => null],
            //   1 => ['name' => 'Prata', 'goal' => 100, 'reward' => '...', 'days_to_downgrade' => 30],
            //   2 => ...
            // ]

            // Group rules by max allowed inactive days per level
            $downgradeRules = [];
            foreach ($levelsConfig as $levelIndex => $config) {
                if (isset($config['days_to_downgrade']) && is_numeric($config['days_to_downgrade']) && $config['days_to_downgrade'] > 0) {
                    $downgradeRules[$levelIndex] = (int)$config['days_to_downgrade'];
                }
            }

            if (empty($downgradeRules)) {
                continue; // No rules set for this tenant
            }

            $customers = \App\Models\Customer::where('tenant_id', $tenantId)
                                             ->where('loyalty_level', '>', 0) // Cannot downgrade level 0
                                             ->get();

            foreach ($customers as $customer) {
                $currentLevel = $customer->loyalty_level;

                if (isset($downgradeRules[$currentLevel])) {
                    $maxDays = $downgradeRules[$currentLevel];
                    $lastActivity = $customer->last_activity_at;

                    if ($lastActivity) {
                        $daysInactive = $lastActivity->diffInDays(now());
                        
                        if ($daysInactive >= $maxDays) {
                            $newLevel = $currentLevel - 1;
                            if ($newLevel < 0) $newLevel = 0;
                            
                            $this->info("Downgrading Customer {$customer->id} from Level {$currentLevel} to {$newLevel} (Inactive for {$daysInactive} days)");
                            
                            $customer->loyalty_level = $newLevel;
                            $customer->save();

                            // Also record a PointMovement so it builds a history?
                            \App\Models\PointMovement::create([
                                'tenant_id' => $tenantId,
                                'customer_id' => $customer->id,
                                'type' => 'redeem', // Using redeem as a deduction logic if points should be cleared, or just log info
                                'points' => 0, // No points deducted here unless specified
                                'origin' => 'system_downgrade',
                                'description' => "Nível de fidelidade rebaixado para {$newLevel} devido a inatividade ({$daysInactive} dias)",
                            ]);
                        }
                    }
                }
            }
        }
        
        $this->info("Downgrade process finished.");
    }
}
