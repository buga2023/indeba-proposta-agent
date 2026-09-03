# Setup da skill transcrever-audio: instala ffmpeg + whisper.cpp + modelo pt
$ErrorActionPreference = 'Stop'
$tools = Join-Path $env:USERPROFILE '.claude\tools\whisper'
New-Item -ItemType Directory -Force $tools | Out-Null

# 1. ffmpeg
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host 'Instalando ffmpeg via winget...'
    winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
}

# 2. whisper.cpp (binario Windows x64)
$cli = Join-Path $tools 'whisper-cli.exe'
if (-not (Test-Path $cli)) {
    Write-Host 'Baixando whisper.cpp...'
    $zip = Join-Path $env:TEMP 'whisper-bin.zip'
    Invoke-WebRequest -Uri 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.2/whisper-bin-x64.zip' -OutFile $zip
    Expand-Archive -Path $zip -DestinationPath $tools -Force
    Remove-Item $zip
    # o zip pode extrair em subpasta; achatar
    Get-ChildItem $tools -Recurse -Filter 'whisper-cli.exe' | Select-Object -First 1 | ForEach-Object {
        if ($_.DirectoryName -ne $tools) { Move-Item "$($_.DirectoryName)\*" $tools -Force }
    }
}

# 3. Modelo multilingue small (~466MB, bom para pt)
$model = Join-Path $tools 'ggml-small.bin'
if (-not (Test-Path $model)) {
    Write-Host 'Baixando modelo ggml-small (multilingue)...'
    Invoke-WebRequest -Uri 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin' -OutFile $model
}

Write-Host "Setup concluido. Ferramentas em: $tools"
