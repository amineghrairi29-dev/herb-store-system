[CmdletBinding()]
param(
    [string]$BackupDirectory,
    # Used by the read-only validation harness to compare one consistent snapshot.
    [ValidatePattern('^[0-9A-Fa-f-]+$')][string]$Snapshot
)
. (Join-Path $PSScriptRoot 'pg-environment.ps1')
Assert-PgEnvironment
if (-not $BackupDirectory) { $BackupDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) 'backups' }
$dumpTool = Get-PgTool 'pg_dump'
$directory = [IO.Path]::GetFullPath($BackupDirectory)
[IO.Directory]::CreateDirectory($directory) | Out-Null
$filename = 'herb_store_db_{0}_{1}.dump' -f (Get-Date -Format 'yyyy-MM-dd_HHmmss_fff'), ([guid]::NewGuid().ToString('N'))
$destination = Join-Path $directory $filename
$partial = "$destination.partial"
# Atomic reservation; no existing backup or partial file can be overwritten.
$reservation = [IO.File]::Open($partial, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
$reservation.Dispose()
$arguments = @('--no-password', '--format=custom', '--file', $partial)
if ($Snapshot) { $arguments += @('--snapshot', $Snapshot) }
try {
    & $dumpTool @arguments
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed (exit $LASTEXITCODE). Incomplete file retained as .partial; do not restore it." }
    if ((Get-Item -LiteralPath $partial).Length -eq 0) { throw 'pg_dump produced an empty file.' }
    # File.Move without overwrite: promote only a successful dump.
    [IO.File]::Move($partial, $destination)
    Write-Output $destination
} catch {
    throw
}
