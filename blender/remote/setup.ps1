$ErrorActionPreference = 'Stop'
$root = "$HOME\lobby-bake"
New-Item -ItemType Directory -Force -Path $root | Out-Null
Set-Location $root
"FREE_GB=" + [math]::Round((Get-PSDrive C).Free / 1GB)
if (-not (Test-Path "$root\blender-5.0.1-windows-x64\blender.exe")) {
  curl.exe -fsSL -o b.zip "https://mirrors.ocf.berkeley.edu/blender/release/Blender5.0/blender-5.0.1-windows-x64.zip"
  $want = ((curl.exe -fsSL "https://ftp.nluug.nl/pub/graphics/blender/release/Blender5.0/blender-5.0.1.sha256") -split "`n" | Where-Object { $_ -match 'windows-x64.zip' }) -split '\s+' | Select-Object -First 1
  $got = (Get-FileHash b.zip -Algorithm SHA256).Hash.ToLower()
  "SHA want=$want got=$got"
  if ($want -ne $got) { throw "checksum mismatch" }
  tar.exe -xf b.zip
  Remove-Item b.zip
}
& "$root\blender-5.0.1-windows-x64\blender.exe" --version | Select-Object -First 1
