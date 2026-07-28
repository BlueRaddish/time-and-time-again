<#
.SYNOPSIS
  Create an isolated git worktree for one parallel Claude session.

.DESCRIPTION
  Each stream gets its own worktree, branch, node_modules, and Metro port. See
  docs/PARALLEL-SESSIONS.md for what each stream owns.

  The port matters: Metro defaults to 8081 for every session, so two sessions started by
  hand will silently serve each other's bundles.

.EXAMPLE
  .\scripts\new-session.ps1 -Stream identity
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [ValidateSet('identity', 'data', 'surface', 'ship')]
  [string]$Stream,

  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'

$ports = @{ identity = 8081; data = 8082; surface = 8083; ship = 8084 }

$repoRoot = (git rev-parse --show-toplevel)
if (-not $?) { throw 'Not inside a git repository.' }
$repoRoot = $repoRoot -replace '/', '\'

$port = $ports[$Stream]
$branch = "stream/$Stream"
$worktree = Join-Path (Split-Path $repoRoot -Parent) "ttag-$Stream"

if (Test-Path $worktree) {
  throw "Worktree already exists at $worktree. Remove it with: git worktree remove `"$worktree`""
}

Write-Host "Creating worktree for '$Stream'" -ForegroundColor Cyan
Write-Host "  branch:   $branch"
Write-Host "  path:     $worktree"
Write-Host "  port:     $port"
Write-Host ''

git -C $repoRoot fetch origin --quiet
git -C $repoRoot worktree add -b $branch $worktree main
if (-not $?) { throw "Failed to create worktree." }

if (-not $SkipInstall) {
  Write-Host 'Installing dependencies (each worktree needs its own node_modules)...' -ForegroundColor Cyan
  Push-Location $worktree
  try {
    npm install
    if (-not $?) { throw 'npm install failed.' }
  } finally {
    Pop-Location
  }
}

Write-Host ''
Write-Host 'Ready.' -ForegroundColor Green
Write-Host ''
Write-Host "  cd $worktree"
Write-Host "  npm run web -- --port $port"
Write-Host ''
$registry = Join-Path $repoRoot 'working.md'
if (-not (Test-Path $registry)) {
  Write-Host "Note: no registry at $registry yet - create it from the template in docs/PARALLEL-SESSIONS.md section 5." -ForegroundColor Yellow
  Write-Host ''
}

Write-Host 'Opening prompt for this session:' -ForegroundColor Cyan
Write-Host ''
Write-Host "  You are the $Stream session for this project. Read docs/PARALLEL-SESSIONS.md and"
Write-Host "  docs/PLAN.md here, and the registry at $registry - it is"
Write-Host '  gitignored, so it is not in this worktree; use that path and do not create a local'
Write-Host '  copy. You own only the paths listed for your stream - if you need a change outside'
Write-Host '  them, note it in the registry and raise it rather than editing. Register your scope'
Write-Host '  there before starting, and run npm test and npm run typecheck before you merge.'
Write-Host ''
