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
Write-Host 'Opening prompt for this session:' -ForegroundColor Cyan
Write-Host ''
Write-Host "  You are the $Stream session for this project. Read docs/PARALLEL-SESSIONS.md,"
Write-Host '  docs/PLAN.md, and working.md first. You own only the paths listed for your'
Write-Host '  stream - if you need a change outside them, note it in working.md and raise it'
Write-Host '  rather than editing. Register your scope in working.md before starting.'
Write-Host ''
