# run-migration.ps1  —  applies 20260522000001_system_settings.sql directly via Supabase REST
# Usage: .\run-migration.ps1

$SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuZGNxZG5zbGxmY25raWRodGVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTE5ODcyNiwiZXhwIjoyMDk0Nzc0NzI2fQ.AeWv2P6C95L48V2XsemkBIMwa8v_yodRi-1VtuLzIKk"
$PROJECT_REF      = "lndcqdnsllfcnkidhtem"
$MIGRATION_FILE   = "$PSScriptRoot\supabase\migrations\20260522000001_system_settings.sql"

$sql = Get-Content $MIGRATION_FILE -Raw

$body = @{ query = $sql } | ConvertTo-Json -Depth 5

Write-Host "Running migration via Supabase Management API..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod `
        -Uri "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" `
        -Method POST `
        -Headers @{
            Authorization  = "Bearer $SERVICE_ROLE_KEY"
            "Content-Type" = "application/json"
            apikey         = $SERVICE_ROLE_KEY
        } `
        -Body $body `
        -ErrorAction Stop

    Write-Host "Migration applied successfully!" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 5
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorBody  = $_.ErrorDetails.Message

    if ($statusCode -eq 404 -or $errorBody -like "*not found*") {
        # Management API needs a PAT token — fall back to direct SQL approach via node
        Write-Host "Management API requires PAT token. Trying via node..." -ForegroundColor Yellow

        $nodeScript = @"
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://lndcqdnsllfcnkidhtem.supabase.co',
  '$SERVICE_ROLE_KEY',
  { auth: { persistSession: false } }
);

const sql = fs.readFileSync('$($MIGRATION_FILE -replace '\\', '/')', 'utf8');

// Split by semicolons and run each statement
const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 5);
console.log('Running', statements.length, 'SQL statements...');

async function run() {
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const { error } = await supabase.rpc('exec_sql', { sql_query: stmt });
    if (error && !error.message.includes('already exists') && !error.message.includes('duplicate')) {
      console.error('Statement', i+1, 'error:', error.message);
      console.error('SQL:', stmt.substring(0, 100));
    } else {
      process.stdout.write('.');
    }
  }
  console.log('\nDone!');
}
run().catch(console.error);
"@
        $nodeScript | node
    } else {
        Write-Host "Error ($statusCode): $errorBody" -ForegroundColor Red
    }
}
