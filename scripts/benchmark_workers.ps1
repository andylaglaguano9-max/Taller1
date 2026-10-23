$limits = @(1, 2, 4, 8)
$results = @()

Write-Host "Iniciando comparacion de limites de Workers (1, 2, 4, 8)..." -ForegroundColor Cyan

foreach ($limit in $limits) {
    Write-Host "`n--- Configurando maxWorkers = $limit ---" -ForegroundColor Yellow
    Invoke-RestMethod -Uri "http://localhost:3000/config" -Method Post -ContentType "application/json" -Body "{`"maxWorkers`": $limit}" | Out-Null
    Start-Sleep -Seconds 1

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $output = k6 run --quiet k6/test4_worker_limits.js
    $sw.Stop()

    $json = $output | ConvertFrom-Json
    $results += [PSCustomObject]@{
        MaxWorkers   = $limit
        ReqPerSec    = $json.rate
        FailedPct    = "$($json.failedRate)%"
        AvgMs        = "$($json.avg) ms"
        P95Ms        = "$($json.p95) ms"
        MaxMs        = "$($json.max) ms"
        TotalTimeSec = [math]::Round($sw.Elapsed.TotalSeconds, 2)
    }
}

Write-Host "`n=========================================================================================" -ForegroundColor Green
Write-Host "                TABLA COMPARATIVA: RENDIMIENTO POR LIMITE DE WORKERS                     " -ForegroundColor Green
Write-Host "=========================================================================================" -ForegroundColor Green
$results | Format-Table -AutoSize
