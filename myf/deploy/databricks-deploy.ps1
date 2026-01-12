Param(
  [Parameter(Mandatory=$true)] [string]$Host,
  [Parameter(Mandatory=$true)] [string]$Token,
  [Parameter(Mandatory=$true)] [string]$WorkspacePath,
  [Parameter(Mandatory=$false)] [string]$AppName = "Beacon-PBI-myf"
)

Write-Host "Starting Databricks deployment for Lakehouse App..." -ForegroundColor Cyan

# Verify databricks CLI is installed
if (-not (Get-Command databricks -ErrorAction SilentlyContinue)) {
  Write-Error "Databricks CLI not found. Install from https://docs.databricks.com/en/dev-tools/cli/databricks-cli.html"
  exit 1
}

# Set CLI environment
$env:DATABRICKS_HOST = $Host
$env:DATABRICKS_TOKEN = $Token

# Resolve repo root (script lives in deploy/)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir

Push-Location $RepoRoot
try {
  Write-Host "Building Vite app (dist/)..." -ForegroundColor Cyan
  npm run build | Out-Host

  # Stage minimal app artifacts for workspace import
  $stageDir = Join-Path $RepoRoot ".stage-app"
  if (Test-Path $stageDir) { Remove-Item -Recurse -Force $stageDir }
  New-Item -ItemType Directory -Path $stageDir | Out-Null

  Copy-Item -Path (Join-Path $RepoRoot "app.yaml") -Destination $stageDir
  Copy-Item -Path (Join-Path $RepoRoot "server.js") -Destination $stageDir
  Copy-Item -Path (Join-Path $RepoRoot "dist") -Destination $stageDir -Recurse

  Write-Host "Creating workspace path: $WorkspacePath" -ForegroundColor Cyan
  databricks workspace mkdirs --absolute $WorkspacePath | Out-Host

  Write-Host "Importing staged app to workspace..." -ForegroundColor Cyan
  databricks workspace import-dir --absolute --overwrite $stageDir $WorkspacePath | Out-Host

  # Try Lakehouse Apps CLI if available
  $appsHelp = databricks apps -h 2>&1 | Out-String
  if ($appsHelp -match "Usage: databricks apps") {
    Write-Host "Apps CLI detected; attempting to create or update app '$AppName'..." -ForegroundColor Cyan
    # Try update first, then create if not exists
    try {
      databricks apps update --name $AppName --source "$WorkspacePath" | Out-Host
    } catch {
      databricks apps create --name $AppName --source "$WorkspacePath" | Out-Host
    }
    Write-Host "If needed, set environment variables in the App UI: STATIC_ROOT=dist, PORT=8000" -ForegroundColor Yellow
  } else {
    Write-Host "Apps CLI not available. Create the Lakehouse App via UI using source: $WorkspacePath" -ForegroundColor Yellow
  }

  Write-Host "Deployment complete." -ForegroundColor Green
} finally {
  Pop-Location
}
