package main

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestPlayer(t *testing.T) {
	for _, tc := range []struct {
		method, url, embed string
		status             int
	}{
		{"GET", "http://" + address + "/youtube?v=aB1-cD2_eF3", "youtube.com/embed/aB1-cD2_eF3", 200},
		{"GET", "http://" + address + "/youtube?list=PL_1-2", "youtube.com/embed/videoseries?list=PL_1-2", 200},
		{"GET", "http://" + address + "/youtube?v=wrong", "", 400},
		{"GET", "http://" + address + "/index.html", "", 404},
		{"GET", "http://example.test/youtube?v=aB1-cD2_eF3", "", 404},
		{"POST", "http://" + address + "/youtube?v=aB1-cD2_eF3", "", 405},
	} {
		req := httptest.NewRequest(tc.method, tc.url, nil)
		rec := httptest.NewRecorder()
		player(rec, req)
		if rec.Code != tc.status || !strings.Contains(rec.Body.String(), tc.embed) {
			t.Errorf("%s %s: got %d, body %q", tc.method, tc.url, rec.Code, rec.Body.String())
		}
	}
}
