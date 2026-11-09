[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$BackupFile,
    [Parameter(Mandatory)][ValidatePattern('^[A-Za-z_][A-Za-z0-9_]{0,62}$')][string]$TargetDatabase,
    # Explicit acknowledgement for an EMPTY, SEPARATE database only.
    [switch]$ConfirmEmptyDatabase
)
. (Join-Path $PSScriptRoot 'pg-environment.ps1')
Assert-PgEnvironment
if ($TargetDatabase -eq $env:PGDATABASE) { throw 'Refusing to restore into the configured source database. Use a separate empty database.' }
$archive = [IO.Path]::GetFullPath($BackupFile)
if (-not (Test-Path -LiteralPath $archive -PathType Leaf)) { throw 'Backup file does not exist.' }
if ([IO.Path]::GetExtension($archive) -ne '.dump' -or (Get-Item -LiteralPath $archive).Length -eq 0) { throw 'Expected a non-empty completed .dump file.' }
$restoreTool = Get-PgTool 'pg_restore'
$psqlTool = Get-PgTool 'psql'
$sourceDatabase = $env:PGDATABASE
try {
    $env:PGDATABASE = $TargetDatabase
    # No --clean or --create. Existing user objects ALWAYS stop V1 recovery.
    $sql = "SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema') + (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema');"
    $objects = & $psqlTool --no-password --no-psqlrc --tuples-only --no-align --set ON_ERROR_STOP=1 --command $sql
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect target database. Restore was not started.' }
    if (($objects | Out-String).Trim() -ne '0') { throw 'Target is not empty. V1 refuses destructive overwrite; provision a new empty recovery database.' }
    Write-Warning "Restore changes database '$TargetDatabase'. Only restore trusted archives. The configured source database is not a restore target."
    if (-not $ConfirmEmptyDatabase) {
        $confirmation = Read-Host "Type RESTORE $TargetDatabase to confirm"
        if ($confirmation -cne "RESTORE $TargetDatabase") { throw 'Restore cancelled.' }
    }
    & $restoreTool --no-password --exit-on-error --single-transaction --no-owner --no-privileges --dbname $TargetDatabase $archive
    if ($LASTEXITCODE -ne 0) { throw "pg_restore failed (exit $LASTEXITCODE). The restore transaction was rolled back." }
    Write-Output "Restore completed into $TargetDatabase. Verify data before application cutover."
} finally {
    $env:PGDATABASE = $sourceDatabase
}
