<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Visit;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class CleanupOldVisits extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:cleanup-old-visits';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Remove visit records older than 12 months (consolidation is handled by attendance_count in Customer model)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $cutoffDate = now()->subMonths(12);

        $count = Visit::where('visit_at', '<', $cutoffDate)->count();

        if ($count > 0) {
            Visit::where('visit_at', '<', $cutoffDate)->delete();
            $this->info("Successfully deleted {$count} old visit records.");
            Log::info("CleanupOldVisits: Removed {$count} records older than {$cutoffDate}.");
        } else {
            $this->info("No old visit records to delete.");
        }
    }
}
