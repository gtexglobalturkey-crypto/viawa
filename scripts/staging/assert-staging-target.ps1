param(
  [Parameter(Mandatory = $true)][string]$ProductionProjectRef,
  [Parameter(Mandatory = $true)][string]$StagingProjectRef
)

$production = $ProductionProjectRef.Trim()
$staging = $StagingProjectRef.Trim()

function Test-ProjectRef([string]$value) {
  return $value -match '^[a-z]{20}$'
}

function Mask-ProjectRef([string]$value) {
  return "$($value.Substring(0, 4))...$($value.Substring($value.Length - 4))"
}

if (-not (Test-ProjectRef $production) -or -not (Test-ProjectRef $staging)) {
  throw 'Both project refs must be explicit 20-character Supabase project refs.'
}

Write-Output "production_ref=$(Mask-ProjectRef $production)"
Write-Output "staging_ref=$(Mask-ProjectRef $staging)"

if ($production -eq $staging) {
  throw 'REFUSING: staging and production project refs are identical.'
}

Write-Output 'STAGING_TARGET_SEPARATION_OK'
