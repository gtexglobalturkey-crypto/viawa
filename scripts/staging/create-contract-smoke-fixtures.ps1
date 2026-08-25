$ErrorActionPreference = "Stop"

$expectedRef = "mmbmepxftibxjsyhlgtg"
$protectedRef = "qpyqqkkkparobyucnqgb"
$linkedRef = (Get-Content "supabase/.temp/project-ref" -Raw).Trim()
if ($linkedRef -ne $expectedRef -or $linkedRef -eq $protectedRef) {
  throw "ABORT: expected staging ref $expectedRef, found $linkedRef"
}

$baseUrl = "https://$linkedRef.supabase.co"
$keys = npx supabase@latest projects api-keys --project-ref $linkedRef --output json | ConvertFrom-Json
$serviceEntry = $keys | Where-Object { $_.name -eq "service_role" -or $_.type -eq "service_role" } | Select-Object -First 1
$serviceKey = if ($serviceEntry.api_key) { $serviceEntry.api_key } elseif ($serviceEntry.key) { $serviceEntry.key } else { $serviceEntry.value }
if (-not $serviceKey) { throw "Staging service role key is unavailable" }

$serviceHeaders = @{ apikey = $serviceKey; Authorization = "Bearer $serviceKey" }
$writeHeaders = $serviceHeaders.Clone()
$writeHeaders.Prefer = "return=representation,resolution=merge-duplicates"
function JsonBytes([object] $Value) {
  $json = ConvertTo-Json -InputObject $Value -Depth 20 -Compress
  return ,([Text.Encoding]::UTF8.GetBytes($json))
}
function Upsert([string] $Table, [object] $Rows) {
  Invoke-RestMethod -Method Post -Uri "$baseUrl/rest/v1/$Table`?on_conflict=id" -Headers $writeHeaders `
    -ContentType "application/json; charset=utf-8" -Body (JsonBytes $Rows)
}
function Unicode([string] $Escaped) {
  return ConvertFrom-Json ('"' + $Escaped + '"')
}

$authUsers = (Invoke-RestMethod -Headers $serviceHeaders -Uri "$baseUrl/auth/v1/admin/users?page=1&per_page=1000").users
function ResolveAuthUser([string] $Email) {
  $matches = @($authUsers | Where-Object { $_.email -eq $Email })
  if ($matches.Count -ne 1) { throw "Expected exactly one staging Auth user for $Email; found $($matches.Count)" }
  return $matches[0]
}
$owner = ResolveAuthUser "viawa.staging.owner@example.com"
$nonowner = ResolveAuthUser "viawa.staging.nonowner@example.com"
$inactive = ResolveAuthUser "viawa.staging.inactive@example.com"

[void](Upsert "application_users" @(
  @{ id=$owner.id; email=$owner.email; full_name="VIAWA Staging Owner"; role="representative"; is_active=$true },
  @{ id=$nonowner.id; email=$nonowner.email; full_name="VIAWA Staging Non-owner"; role="representative"; is_active=$true },
  @{ id=$inactive.id; email=$inactive.email; full_name="VIAWA Staging Inactive"; role="representative"; is_active=$false }
))

$companyId = "71000000-0000-4000-8000-000000000001"
$exhibitionId = "71000000-0000-4000-8000-000000000002"
$primaryId = "71000000-0000-4000-8000-000000000003"
$signatoryId = "71000000-0000-4000-8000-000000000004"
$opportunityId = "71000000-0000-4000-8000-000000000005"
$snapshotId = "71000000-0000-4000-8000-000000000006"

$turkishProbeCompany = Unicode 'VIAWA STAGING TEST \u00c7\u011e\u0130\u00d6\u015e\u00dc MADENC\u0130L\u0130K \u00e7\u011f\u0131\u00f6\u015f\u00fc LTD.'
$turkiye = Unicode 'T\u00fcrkiye'
$istanbul = Unicode '\u0130stanbul'
$signatoryTitle = Unicode '\u0130mza Yetkilisi'
[void](Upsert "companies" @(@{ id=$companyId; company_name=$turkishProbeCompany; contact_person="STAGING PRIMARY CONTACT"; email="staging.company@example.invalid"; phone="+90 555 000 0001"; website="https://staging.example.invalid"; country=$turkiye; industry="Madencilik"; status="active"; tax_office="STAGING"; tax_number="STG0000001"; postal_code="00000"; address="Sentetik Test Adresi No: 1"; city=$istanbul; district="Test" }))
[void](Upsert "exhibitions" @(@{ id=$exhibitionId; name="VIAWA STAGING TEST FAIR 2027"; city=$istanbul; country=$turkiye; sector="Madencilik"; organizer="VIAWA STAGING SYNTHETIC ORGANIZER"; start_date="2027-05-24"; end_date="2027-05-27" }))
[void](Upsert "contacts" @(
  @{ id=$primaryId; user_id=$owner.id; company_id=$companyId; first_name="Staging"; last_name="Primary"; title="Fuar Yetkilisi"; email="staging.primary@example.invalid"; phone="+90 555 000 0002"; is_primary=$true; is_signatory=$false },
  @{ id=$signatoryId; user_id=$owner.id; company_id=$companyId; first_name="Staging"; last_name="Signatory"; title=$signatoryTitle; email="staging.signatory@example.invalid"; phone="+90 555 000 0003"; is_primary=$false; is_signatory=$true }
))
$paymentPlan = @(
  @{ dueDate="2027-01-15"; amount=4905; payee=(Unicode 'STAGING TEST TAKS\u0130T 1') },
  @{ dueDate="2027-03-15"; amount=4905; payee=(Unicode 'STAGING TEST TAKS\u0130T 2') }
)
[void](Upsert "opportunities" @(@{ id=$opportunityId; company_id=$companyId; exhibition_id=$exhibitionId; contact_id=$primaryId; stage="contract"; interest_level=5; estimated_value=9810; owner=$owner.id; payment_plan=$paymentPlan; stand_materials=@(); extra_information=@{ fixture="synthetic-staging-only" } }))
[void](Upsert "document_settings" @(@{ id="participation-contract"; issuer=@{ companyName="VIAWA STAGING SYNTHETIC ISSUER"; status="STAGING_CONFIGURATION"; address="Sentetik VIAWA Staging Adresi"; mersisNumber="STAGING-MERSIS"; tradeRegistryNumber="STAGING-REGISTRY"; taxOffice="STAGING"; taxNumber="STAGING-TAX"; website="https://staging.example.invalid"; representativeNameTitle="Staging Yetkili Temsilci" }; bank=@{ bankName="STAGING TEST BANK"; branchAddress="STAGING TEST BRANCH"; ibanEur="TR00 0000 0000 0000 0000 0000 01"; ibanUsd="TR00 0000 0000 0000 0000 0000 02" }; contract_defaults=@{ environment="staging"; synthetic=$true }; document_defaults=@{ documentType="participation-contract"; synthetic=$true }; updated_by=$owner.id }))

$existingSnapshot = @(Invoke-RestMethod -Headers $writeHeaders -Uri "$baseUrl/rest/v1/approved_price_snapshots?id=eq.$snapshotId&select=id")
if (-not $existingSnapshot -or $existingSnapshot.Count -eq 0) {
  $priceInput = @{ exhibitionId=$exhibitionId; standType="custom-stand"; standLocationType="corner"; standAreaSqm=12; basePricePerSqm=600; currency="USD" }
  $priceResult = @{ currency="USD"; sqmAmount=7200; locationSurcharge=0; participationFee=7200; registrationFee=500; serviceFee=750; additionalServicesFee=0; subtotal=8450; discountAmount=0; vatAmount=1360; grandTotal=9810; appliedInput=$priceInput }
  $snapshot = @{ id=$snapshotId; company_id=$companyId; opportunity_id=$opportunityId; exhibition_id=$exhibitionId; created_by=$owner.id; currency="USD"; price_input=$priceInput; price_result=$priceResult; pricing_source="staging-synthetic-fixture"; pricing_source_version="1"; matched_repository_folder="STAGING-SYNTHETIC" }
  [void](Invoke-RestMethod -Method Post -Uri "$baseUrl/rest/v1/approved_price_snapshots" -Headers $writeHeaders -ContentType "application/json; charset=utf-8" -Body (JsonBytes $snapshot))
}

# Generate a short-lived owner session without changing a password or sending email.
$link = Invoke-RestMethod -Method Post -Uri "$baseUrl/auth/v1/admin/generate_link" -Headers $serviceHeaders -ContentType "application/json; charset=utf-8" -Body (JsonBytes @{ type="magiclink"; email=$owner.email })
$tokenHash = if ($link.hashed_token) { $link.hashed_token } else { $link.properties.hashed_token }
if (-not $tokenHash) { throw "Auth generate_link did not return a token hash" }
$session = Invoke-RestMethod -Method Post -Uri "$baseUrl/auth/v1/verify" -Headers @{ apikey=$serviceKey } -ContentType "application/json; charset=utf-8" -Body (JsonBytes @{ type="magiclink"; token_hash=$tokenHash })
if (-not $session.access_token) { throw "Could not establish the staging owner session" }
$ownerHeaders = @{ apikey=$serviceKey; Authorization="Bearer $($session.access_token)"; Prefer="return=representation" }
$contractNumber = Invoke-RestMethod -Method Post -Uri "$baseUrl/rest/v1/rpc/get_or_create_contract_number" -Headers $ownerHeaders -ContentType "application/json; charset=utf-8" -Body (JsonBytes @{ p_company_id=$companyId; p_opportunity_id=$opportunityId; p_exhibition_id=$exhibitionId })

[pscustomobject]@{
  ref=$linkedRef; owner=$owner.id; nonowner=$nonowner.id; inactive=$inactive.id
  company=$companyId; exhibition=$exhibitionId; opportunity=$opportunityId
  primary_contact=$primaryId; signatory_contact=$signatoryId; snapshot=$snapshotId
  contract_number=$contractNumber
} | ConvertTo-Json -Compress
