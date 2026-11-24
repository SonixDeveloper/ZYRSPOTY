// The desktop launchers use this loopback-only page to give the official
// YouTube iframe an HTTP referrer while preserving the library's file origin.
package main

import (
	"html/template"
	"log"
	"net"
	"net/http"
	"regexp"
	"time"
)

const address = "127.0.0.1:42681"

var (
	videoID    = regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`)
	playlistID = regexp.MustCompile(`^[A-Za-z0-9_-]{2,100}$`)
	playerPage = template.Must(template.New("player").Parse(`<!doctype html>
<meta charset="utf-8">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>YouTube</title>
<style>html,body,iframe{width:100%;height:100%;margin:0;border:0}iframe{display:block}</style>
<iframe title="YouTube" referrerpolicy="strict-origin-when-cross-origin"
 allow="encrypted-media; fullscreen; picture-in-picture" allowfullscreen src="{{.}}"></iframe>`))
)

func player(w http.ResponseWriter, r *http.Request) {
	if r.Host != address || r.URL.Path != "/youtube" {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	query := r.URL.Query()
	var source string
	switch {
	case videoID.MatchString(query.Get("v")):
		source = "https://www.youtube.com/embed/" + query.Get("v") + "?playsinline=1"
	case playlistID.MatchString(query.Get("list")):
		source = "https://www.youtube.com/embed/videoseries?list=" + query.Get("list")
	default:
		http.Error(w, "Invalid YouTube link", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; frame-src https://www.youtube.com")
	w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if err := playerPage.Execute(w, source); err != nil {
		log.Print(err)
	}
}

func main() {
	listener, err := net.Listen("tcp4", address)
	if err != nil {
		// A launcher might already have started the player.
		return
	}
	defer listener.Close()

	server := &http.Server{
		Handler:           http.HandlerFunc(player),
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      5 * time.Second,
		IdleTimeout:       30 * time.Second,
	}
	log.Fatal(server.Serve(listener))
}
