$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$source = $env:ZRYSPOTY_SELF
$base = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'ZRYSPOTY'
$folder = Join-Path $base 'ZRYSPOTY'
$version = Join-Path $folder '.version-1.0.5'
$zip = New-TemporaryFile
$stage = Join-Path $base ([Guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Path $base -Force | Out-Null
    if (!(Test-Path -LiteralPath $version)) {
        $inputFile = [IO.File]::OpenRead($source)
        try {
            [void]$inputFile.Seek(-4, [IO.SeekOrigin]::End)
            $reader = New-Object IO.BinaryReader($inputFile)
            $size = $reader.ReadInt32()
            if ($size -le 0 -or $size -ge $inputFile.Length - 4) { throw 'Uszkodzony plik ZRYSPOTY.exe.' }
            [void]$inputFile.Seek(-4 - $size, [IO.SeekOrigin]::End)
            [IO.File]::WriteAllBytes($zip.FullName, $reader.ReadBytes($size))
        } finally { $inputFile.Dispose() }
        [IO.Compression.ZipFile]::ExtractToDirectory($zip.FullName, $stage)
        $new = Join-Path $stage 'ZRYSPOTY'
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
        Get-ChildItem -LiteralPath $new | Where-Object { $_.Name -ne 'index.html' } |
            Copy-Item -Destination $folder -Recurse -Force
        Copy-Item -LiteralPath (Join-Path $new 'index.html') -Destination $folder -Force
        New-Item -ItemType File -Path $version -Force | Out-Null
    }
    Start-Process (Join-Path $folder 'zryspoty-player.exe') -WindowStyle Hidden
    Start-Process (Join-Path $folder 'index.html')
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [void][Windows.Forms.MessageBox]::Show($_.Exception.Message, 'ZRYSPOTY')
    exit 1
} finally {
    Remove-Item -LiteralPath $zip.FullName, $stage -Recurse -Force -ErrorAction SilentlyContinue
}
