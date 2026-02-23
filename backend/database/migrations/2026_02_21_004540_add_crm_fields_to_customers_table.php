<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->date('birthday')->nullable()->after('email');
            $table->json('tags')->nullable()->after('city');
            $table->json('preferences')->nullable()->after('tags');
            $table->decimal('total_spent', 10, 2)->default(0)->after('last_activity_at');
            $table->decimal('average_ticket', 10, 2)->default(0)->after('total_spent');
            $table->integer('attendance_count')->default(0)->after('average_ticket');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn(['birthday', 'tags', 'preferences', 'total_spent', 'average_ticket', 'attendance_count']);
        });
    }
};
