#!/bin/sh
set -eu
tools=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
source_dir=$1
output=$2
temp=$(mktemp -d)
trap 'rm -rf -- "$temp"' EXIT
for dll in kernel32 shell32 user32; do
    case "$dll" in
        kernel32) set -- GetModuleFileNameW ExitProcess SetEnvironmentVariableW;;
        shell32) set -- ShellExecuteW;;
        user32) set -- MessageBoxW;;
    esac
    { printf 'LIBRARY %s.dll\nEXPORTS\n' "$dll"; printf '%s\n' "$@"; } > "$temp/$dll.def"
    llvm-dlltool -m i386:x86-64 -d "$temp/$dll.def" -l "$temp/$dll.lib"
done
python3 - "$tools/windows.ps1" "$temp/payload.h" <<'PY'
from base64 import b64encode
from pathlib import Path
import sys
script, header = map(Path, sys.argv[1:])
encoded = b64encode(script.read_text().encode('utf-16le')).decode('ascii')
header.write_text('#define PARAMETERS L"-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand ' + encoded + '"\n')
PY
clang --target=x86_64-pc-windows-msvc -ffreestanding -fno-stack-protector -Os -I"$temp" -c "$tools/windows.c" -o "$temp/launcher.obj"
lld-link /nodefaultlib /entry:mainCRTStartup /subsystem:windows /out:"$temp/launcher.exe" \
    "$temp/launcher.obj" "$temp/kernel32.lib" "$temp/shell32.lib" "$temp/user32.lib"
python3 - "$temp/launcher.exe" "$source_dir" "$output" <<'PY'
from pathlib import Path
import os
import sys
from zipfile import ZIP_DEFLATED, ZipFile
from io import BytesIO
launcher, source, output = map(Path, sys.argv[1:])
archive = BytesIO()
with ZipFile(archive, 'w', ZIP_DEFLATED) as package:
    for path in sorted(source.rglob('*')):
        if path.is_file() and path.name not in ('Zainstaluj.sh', 'ZRYSPOTY'):
            name = 'ZRYSPOTY/' + str(path.relative_to(source))
            if path.name == 'index.html':
                package.writestr(name, path.read_text().replace('<head>', '<head><meta name="zryspoty-desktop-player">', 1))
            else:
                package.write(path, name)
    package.write(os.environ['ZRYSPOTY_PLAYER_WINDOWS'], 'ZRYSPOTY/zryspoty-player-1.0.6.exe')
payload = archive.getvalue()
output.write_bytes(launcher.read_bytes() + payload + len(payload).to_bytes(4, 'little'))
PY
