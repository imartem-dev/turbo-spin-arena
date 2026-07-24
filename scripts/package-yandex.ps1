$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$dist = (Resolve-Path (Join-Path $projectRoot "dist-yandex")).Path
$archive = Join-Path $projectRoot "beat-and-spin-yandex.zip"

if (-not $dist.StartsWith($projectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Yandex build path is outside the project root."
}

if (Test-Path -LiteralPath $archive) {
  Remove-Item -LiteralPath $archive -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$archiveStream = [System.IO.File]::Open(
  $archive,
  [System.IO.FileMode]::CreateNew,
  [System.IO.FileAccess]::ReadWrite,
  [System.IO.FileShare]::None
)

try {
  $zip = [System.IO.Compression.ZipArchive]::new(
    $archiveStream,
    [System.IO.Compression.ZipArchiveMode]::Create,
    $false
  )

  try {
    Get-ChildItem -LiteralPath $dist -File -Recurse | ForEach-Object {
      $entryName = $_.FullName.Substring($dist.Length).TrimStart('\', '/') -replace '\\', '/'
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $zip,
        $_.FullName,
        $entryName,
        [System.IO.Compression.CompressionLevel]::Optimal
      ) | Out-Null
    }
  }
  finally {
    $zip.Dispose()
  }
}
finally {
  $archiveStream.Dispose()
}

$verificationArchive = [System.IO.Compression.ZipFile]::OpenRead($archive)

try {
  $entryNames = @($verificationArchive.Entries | ForEach-Object { $_.FullName })
  $sourceFileCount = @(Get-ChildItem -LiteralPath $dist -File -Recurse).Count

  if ($entryNames.Count -ne $sourceFileCount) {
    throw "Yandex archive file count does not match the build output."
  }

  if ($entryNames -notcontains "index.html") {
    throw "Yandex archive must contain index.html at its root."
  }

  if ($entryNames | Where-Object { $_.Contains('\') }) {
    throw "Yandex archive contains Windows path separators."
  }
}
finally {
  $verificationArchive.Dispose()
}

Write-Output $archive
