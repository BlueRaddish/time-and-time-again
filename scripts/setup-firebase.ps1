<#
.SYNOPSIS
  create the firebase project and wire it into this repo

.DESCRIPTION
  Runs every part of phase 0 that has a command-line equivalent: creates the project and the
  Firestore database, deploys the security rules, registers the web and android apps, and
  writes their config into .env.local.

  It cannot do the parts Google only exposes through a browser. It prints those at the end.

  Safe to re-run. Every step checks for what it would create and skips it if it is already
  there, so a failure halfway through is fixed by running the script again.

.PARAMETER ProjectId
  Globally unique across all of Google Cloud, so the obvious name may be taken.
  Lowercase letters, digits and hyphens, 6-30 characters.

.PARAMETER Location
  Firestore location. PERMANENT -- it cannot be changed after the database exists, and moving
  data later means a new project. asia-northeast3 is Seoul; us-central1 and europe-west1 are
  the usual alternatives.

.PARAMETER SkipRules
  Register apps and write .env.local without deploying firestore.rules.

.EXAMPLE
  .\scripts\setup-firebase.ps1
  .\scripts\setup-firebase.ps1 -ProjectId ttag-prod -Location us-central1
#>

[CmdletBinding()]
param(
  [string]$ProjectId = 'time-and-time-again',
  [string]$Location = 'asia-northeast3',
  [switch]$SkipRules
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot '.env.local'
$androidPackage = 'com.blueraddish.timeandtimeagain'

<#
  Never redirect a native command's stderr with 2>&1 here.

  Windows PowerShell 5.1 wraps every stderr line from an exe in an ErrorRecord and sets $? to
  false even when the exe exited 0. firebase-tools writes its progress spinner to stderr, so
  `firebase ... 2>&1` turns a completely successful call into a terminating NativeCommandError
  under $ErrorActionPreference = 'Stop'. Let stderr go to the console and judge success by
  $LASTEXITCODE instead.
#>
function Get-FirebaseOutput {
  param([string[]]$FirebaseArgs)
  $output = & npx --yes firebase-tools@latest @FirebaseArgs
  return ($output | Out-String)
}

function Invoke-Firebase {
  param([string[]]$FirebaseArgs)
  & npx --yes firebase-tools@latest @FirebaseArgs
}

function Write-Step { param([string]$Text) Write-Host "`n== $Text" -ForegroundColor Cyan }
function Write-Skip { param([string]$Text) Write-Host "   already done: $Text" -ForegroundColor DarkGray }

# --- 1. authentication -------------------------------------------------------------------
# Deliberately not automated. `firebase login` opens a browser and asks for a Google password;
# that credential is yours and should never pass through a script or a session log.
Write-Step 'checking that you are signed in'
$loginCheck = Get-FirebaseOutput @('login:list')
if ($loginCheck -notmatch 'Logged in as') {
  Write-Host 'Not signed in. Run this yourself first, then re-run this script:' -ForegroundColor Yellow
  Write-Host '    npx firebase-tools login' -ForegroundColor Yellow
  exit 1
}
Write-Host $loginCheck.Trim()

# --- 2. the project ----------------------------------------------------------------------
Write-Step "creating project $ProjectId"
$existing = Get-FirebaseOutput @('projects:list', '--json')
if ($existing -match [regex]::Escape("`"projectId`": `"$ProjectId`"")) {
  Write-Skip "project $ProjectId exists"
} else {
  Invoke-Firebase @('projects:create', $ProjectId, '--display-name', 'Time and Time Again')
  if ($LASTEXITCODE -ne 0) {
    throw "Could not create $ProjectId. The id may be taken globally -- re-run with -ProjectId <something-else>."
  }
}

# --- 3. firestore ------------------------------------------------------------------------
Write-Step "creating the Firestore database in $Location"
Write-Host '   this location is permanent and cannot be changed later' -ForegroundColor Yellow
Invoke-Firebase @('firestore:databases:create', '(default)', '--location', $Location, '--project', $ProjectId)
if ($LASTEXITCODE -ne 0) {
  Write-Skip 'database already exists (or the message above says otherwise)'
}

if (-not $SkipRules) {
  Write-Step 'deploying security rules'
  Invoke-Firebase @('deploy', '--only', 'firestore:rules', '--project', $ProjectId)
  if ($LASTEXITCODE -ne 0) { throw 'Rules deploy failed. The database may not exist yet.' }
}

# --- 4. apps ------------------------------------------------------------------------------
Write-Step 'registering the web and android apps'
$apps = Get-FirebaseOutput @('apps:list', '--project', $ProjectId, '--json')

if ($apps -match '"platform":\s*"WEB"') {
  Write-Skip 'web app registered'
} else {
  Invoke-Firebase @('apps:create', 'WEB', 'Time and Time Again (web)', '--project', $ProjectId)
  if ($LASTEXITCODE -ne 0) { throw 'Could not register the web app.' }
}

if ($apps -match '"platform":\s*"ANDROID"') {
  Write-Skip 'android app registered'
} else {
  Invoke-Firebase @('apps:create', 'ANDROID', 'Time and Time Again (android)',
    '--package-name', $androidPackage, '--project', $ProjectId)
  if ($LASTEXITCODE -ne 0) { throw 'Could not register the android app.' }
}

# --- 5. .env.local -------------------------------------------------------------------------
Write-Step 'writing .env.local'
if (Test-Path $envFile) {
  # Never clobber a file that may hold hand-entered OAuth client ids.
  $backup = "$envFile.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
  Copy-Item $envFile $backup
  Write-Host "   existing file backed up to $(Split-Path -Leaf $backup)" -ForegroundColor DarkGray
}

$configRaw = Get-FirebaseOutput @('apps:sdkconfig', 'WEB', '--project', $ProjectId, '--json')
if ($LASTEXITCODE -ne 0) { throw 'Could not read the web SDK config.' }
$config = ($configRaw | ConvertFrom-Json).result.sdkConfig

$envContents = @"
# Written by scripts/setup-firebase.ps1 on $(Get-Date -Format 'yyyy-MM-dd HH:mm').
# Gitignored. Safe to regenerate; the two Google client ids below are NOT written by the
# script and must be pasted in by hand -- see the console steps it printed.

EXPO_PUBLIC_FIREBASE_API_KEY=$($config.apiKey)
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=$($config.authDomain)
EXPO_PUBLIC_FIREBASE_PROJECT_ID=$($config.projectId)
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=$($config.storageBucket)
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$($config.messagingSenderId)
EXPO_PUBLIC_FIREBASE_APP_ID=$($config.appId)

EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
"@

# WriteAllText with an explicit BOM-less encoder, not Out-File -Encoding utf8.
# Windows PowerShell 5.1's utf8 writes a BOM, and a BOM at the top of a .env file becomes part
# of the first key's name -- so the first variable silently reads as undefined. It only looks
# harmless here because line 1 is a comment; reorder the file and it breaks.
[System.IO.File]::WriteAllText($envFile, $envContents, (New-Object System.Text.UTF8Encoding $false))

Write-Host "   wrote $(Split-Path -Leaf $envFile)"

# --- what is left ---------------------------------------------------------------------------
Write-Host @"

== done. the rest is browser-only

Google exposes no API for any of this. Full detail in docs/PHASE-0.md.

  1. Turn on sign-in methods
     https://console.firebase.google.com/project/$ProjectId/authentication/providers
     Enable Email/Password and Google.

  2. Create OAuth client ids, then paste them into .env.local
     https://console.cloud.google.com/apis/credentials?project=$ProjectId
     One Web client and one Android client (package $androidPackage, plus your signing SHA-1).

  3. Enable the two APIs the sync needs
     https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=$ProjectId
     https://console.cloud.google.com/apis/library/tasks.googleapis.com?project=$ProjectId

  4. Submit the OAuth consent screen -- THE LONG CLOCK, do it today
     https://console.cloud.google.com/auth/overview?project=$ProjectId
     Both scopes in ONE submission: calendar.events and tasks.
     Adding one later restarts verification from zero.

  5. Only when you want to deploy Cloud Functions (phase 4)
     Functions require the Blaze plan, which needs a card on file. Firestore, Auth and
     Hosting all work on the free Spark plan, so phases 2 and 3 can be tested without it.

Then: npm run web -- and the app will ask you to sign in.
"@ -ForegroundColor Green
