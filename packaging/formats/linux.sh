#!/bin/sh
set -eu
source_dir=$1
output=$(realpath "$2")
format=$3
tools=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
temp=$(mktemp -d)
trap 'rm -rf -- "$temp"' EXIT
id=pl.zryspoty.player

case "$format" in
    deb|appimage)
        app="$temp/root"
        mkdir -p "$app/usr/bin" "$app/usr/share/zryspoty" "$app/usr/share/applications" "$app/usr/share/icons/hicolor/512x512/apps"
        install -m644 "$tools/$id.desktop" "$app/usr/share/applications/"
        install -m644 "$source_dir/icon.png" "$app/usr/share/icons/hicolor/512x512/apps/$id.png"
        cp -r "$source_dir/." "$app/usr/share/zryspoty/"
        rm -f "$app/usr/share/zryspoty/Zainstaluj.sh" "$app/usr/share/zryspoty/ZRYSPOTY"
        cat > "$app/usr/bin/zryspoty" <<'LAUNCH'
#!/bin/sh
base=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
exec xdg-open "$base/share/zryspoty/index.html"
LAUNCH
        chmod +x "$app/usr/bin/zryspoty"
        if [ "$format" = deb ]; then
            mkdir "$temp/control"
            cat > "$temp/control/control" <<'CONTROL'
Package: zryspoty
Version: 1.0.2
Architecture: all
Section: sound
Priority: optional
Maintainer: ZRYSPOTY <https://github.com/SonixDeveloper/ZYRSPOTY/issues>
Depends: xdg-utils
Description: Lokalny odtwarzacz muzyki ZRYSPOTY
CONTROL
            printf '2.0\n' > "$temp/debian-binary"
            tar -czf "$temp/control.tar.gz" --owner=0 --group=0 -C "$temp/control" .
            tar -czf "$temp/data.tar.gz" --owner=0 --group=0 -C "$app" .
            (cd "$temp" && ar cr "$output/ZRYSPOTY-Linux.deb" debian-binary control.tar.gz data.tar.gz)
        else
            cp "$tools/$id.desktop" "$app/"
            cp "$source_dir/icon.png" "$app/$id.png"
            cat > "$app/AppRun" <<'APPRUN'
#!/bin/sh
root=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
# Preserve the browser's storage origin after the AppImage is unmounted.
data=${XDG_DATA_HOME:-"$HOME/.local/share"}/zryspoty/appimage-1.0.1
if [ ! -f "$data/.version-1.0.2" ]; then
    mkdir -p "$data"
    cp -r "$root/usr/share/zryspoty/assets" "$data/"
    cp "$root/usr/share/zryspoty/"*.js "$root/usr/share/zryspoty/"*.css \
        "$root/usr/share/zryspoty/"*.png "$root/usr/share/zryspoty/"*.webmanifest "$data/"
    cp "$root/usr/share/zryspoty/index.html" "$data/"
    touch "$data/.version-1.0.2"
fi
exec xdg-open "$data/index.html"
APPRUN
            chmod +x "$app/AppRun"
            ARCH=x86_64 APPIMAGE_EXTRACT_AND_RUN=1 "${APPIMAGETOOL:-appimagetool}" "$app" "$output/ZRYSPOTY-Linux-x86_64.AppImage"
        fi
        ;;
    flatpak)
        app="$temp/root"
        mkdir -p "$app/files/bin" "$app/files/share/zryspoty" "$app/export/share/applications" "$app/export/share/icons/hicolor/512x512/apps"
        cp -r "$source_dir/." "$app/files/share/zryspoty/"
        rm -f "$app/files/share/zryspoty/Zainstaluj.sh" "$app/files/share/zryspoty/ZRYSPOTY"
        install -m644 "$tools/flatpak.js" "$app/files/share/zryspoty/"
        install -m644 "$tools/$id.desktop" "$app/export/share/applications/"
        mkdir -p "$app/files/share/icons/hicolor/512x512/apps"
        install -m644 "$source_dir/icon.png" "$app/files/share/icons/hicolor/512x512/apps/$id.png"
        cat > "$app/files/bin/zryspoty" <<'LAUNCH'
#!/bin/sh
exec gjs -m /app/share/zryspoty/flatpak.js
LAUNCH
        chmod +x "$app/files/bin/zryspoty"
        cat > "$app/metadata" <<META
[Application]
name=$id
runtime=org.gnome.Platform/$(flatpak --default-arch)/50
sdk=org.gnome.Sdk/$(flatpak --default-arch)/50
command=zryspoty

[Context]
shared=ipc;
sockets=wayland;fallback-x11;pulseaudio;
devices=dri;
META
        flatpak build-export --disable-sandbox "$temp/repo" "$app" stable
        flatpak build-bundle --runtime-repo=https://dl.flathub.org/repo/flathub.flatpakrepo "$temp/repo" "$output/ZRYSPOTY-Linux.flatpak" "$id" stable
        ;;
    *) exit 2;;
esac
