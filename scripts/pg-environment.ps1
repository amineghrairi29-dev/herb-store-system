Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-PgEnvironment {
    foreach ($key in @('PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER')) {
        if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($key, 'Process'))) {
            throw "$key is required in this shell. Use PGPASSWORD or pgpass for the password; never put it in command arguments."
        }
    }
    if ($env:PGPORT -notmatch '^\d{1,5}$' -or [int]$env:PGPORT -lt 1 -or [int]$env:PGPORT -gt 65535) { throw 'Invalid PGPORT.' }
    # Restrict database names so libpq cannot interpret a name as a connection string.
    if ($env:PGDATABASE -notmatch '^[A-Za-z_][A-Za-z0-9_-]{0,62}$') { throw 'PGDATABASE must be a plain database name.' }
}

function Get-PgTool([string]$Name) {
    $tool = Get-Command -Name "$Name.exe" -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $tool) { throw "$Name is not on PATH. Install official PostgreSQL client tools matching the server major version." }
    return $tool.Source
}
