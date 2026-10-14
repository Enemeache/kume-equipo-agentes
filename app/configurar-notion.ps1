# Guarda la clave de Notion en .env sin que quede escrita en ningún chat.
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host ""
Write-Host "Küme HQ - conectar Notion" -ForegroundColor Green
Write-Host "Pegá la clave de tu integración (empieza con ntn_) y apretá Enter."
Write-Host "No se va a ver mientras la pegás: es normal."
$sec = Read-Host -AsSecureString "Clave"
$token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)).Trim()

if (-not ($token -match '^(ntn_|secret_)')) {
  Write-Host "Eso no parece una clave de Notion (tiene que empezar con ntn_). No guardé nada." -ForegroundColor Red
  Read-Host "Enter para cerrar"
  exit 1
}

$envFile = Join-Path $dir ".env"
Set-Content -Path $envFile -Value "NOTION_TOKEN=$token" -Encoding ascii
Write-Host "Listo: clave guardada en .env" -ForegroundColor Green

# Probar la conexión con la base Prospectos
try {
  $h = @{ Authorization = "Bearer $token"; "Notion-Version" = "2025-09-03"; "Content-Type" = "application/json" }
  $r = Invoke-RestMethod -Method Post -Uri "https://api.notion.com/v1/data_sources/634cf749-0bd2-4a14-85d9-e1860b74b3a8/query" -Headers $h -Body '{"page_size":5}'
  Write-Host "Conexión OK: veo $($r.results.Count) prospectos." -ForegroundColor Green
} catch {
  Write-Host "La clave se guardó, pero Notion todavía no da acceso a la base." -ForegroundColor Yellow
  Write-Host "En Notion: página 'Küme — Equipo de agentes' -> ··· -> Conexiones -> agregá 'Küme HQ'."
}

# Reiniciar la app para que tome la clave
Get-NetTCPConnection -LocalPort 4747 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -Confirm:$false }
Write-Host "Abrí el acceso directo Küme HQ del Escritorio."
Read-Host "Enter para cerrar"
