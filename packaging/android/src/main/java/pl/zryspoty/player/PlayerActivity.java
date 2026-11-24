package pl.zryspoty.player;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class PlayerActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String HOME = "https://" + HOST + "/index.html";
    private static final int PICK_AUDIO = 1;
    private static final Pattern RANGE = Pattern.compile("bytes=(\\d+)-(\\d*)");
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    public void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().setStatusBarColor(Color.rgb(16, 14, 22));
        getWindow().setNavigationBarColor(Color.rgb(16, 14, 22));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(16, 14, 22));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(true);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return serveAsset(request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if ("https".equals(url.getScheme()) && HOST.equals(url.getHost())) return false;
                if (request.isForMainFrame() && "https".equals(url.getScheme()) && ("open.spotify.com".equals(url.getHost()) || "spotify.link".equals(url.getHost()))) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, url));
                    } catch (ActivityNotFoundException error) {
                        Toast.makeText(PlayerActivity.this, "Zainstaluj przeglądarkę lub Spotify.", Toast.LENGTH_SHORT).show();
                    }
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("audio/*");
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try {
                    startActivityForResult(intent, PICK_AUDIO);
                } catch (ActivityNotFoundException error) {
                    fileCallback.onReceiveValue(null);
                    fileCallback = null;
                }
                return true;
            }
        });
        setContentView(web);
        web.loadUrl(HOME);
    }

    private static WebResourceResponse response(int status, String reason, Map<String, String> headers) {
        return new WebResourceResponse("text/plain", "UTF-8", status, reason, headers, new ByteArrayInputStream(new byte[0]));
    }

    private WebResourceResponse serveAsset(WebResourceRequest request) {
        Uri url = request.getUrl();
        if (!"https".equals(url.getScheme()) || !HOST.equals(url.getHost()) || !"GET".equals(request.getMethod())) {
            return response(403, "Forbidden", new HashMap<>());
        }
        String path = url.getPath();
        if (path == null || !path.matches("/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_.-]+") ||
            path.contains("..")) {
            return response(404, "Not Found", new HashMap<>());
        }
        String asset = path.substring(1);
        try {
            if (asset.endsWith(".mp3")) return serveAudio(asset, request.getRequestHeaders());
            String type = asset.endsWith(".html") ? "text/html"
                : asset.endsWith(".css") ? "text/css"
                : asset.endsWith(".js") ? "application/javascript"
                : asset.endsWith(".webmanifest") ? "application/manifest+json"
                : asset.endsWith(".webp") ? "image/webp"
                : asset.endsWith(".png") ? "image/png" : "application/octet-stream";
            return new WebResourceResponse(type, type.startsWith("image/") ? null : StandardCharsets.UTF_8.name(),
                getAssets().open(asset));
        } catch (IOException error) {
            return response(404, "Not Found", new HashMap<>());
        }
    }

    private WebResourceResponse serveAudio(String asset, Map<String, String> requestHeaders) throws IOException {
        String range = null;
        for (Map.Entry<String, String> header : requestHeaders.entrySet()) {
            if ("Range".equalsIgnoreCase(header.getKey())) range = header.getValue();
        }
        if (range == null) return new WebResourceResponse("audio/mpeg", null, getAssets().open(asset));
        byte[] audio;
        try (java.io.InputStream stream = getAssets().open(asset);
             java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream()) {
            byte[] chunk = new byte[8192];
            int size;
            while ((size = stream.read(chunk)) != -1) buffer.write(chunk, 0, size);
            audio = buffer.toByteArray();
        }
        Map<String, String> headers = new HashMap<>();
        headers.put("Accept-Ranges", "bytes");
        Matcher match = RANGE.matcher(range);
        if (match.matches()) {
            try {
                int start = Integer.parseInt(match.group(1));
                int end = match.group(2).isEmpty() ? audio.length - 1 : Math.min(Integer.parseInt(match.group(2)), audio.length - 1);
                if (start <= end) {
                    int length = end - start + 1;
                    headers.put("Content-Length", Integer.toString(length));
                    headers.put("Content-Range", "bytes " + start + "-" + end + "/" + audio.length);
                    return new WebResourceResponse("audio/mpeg", null, 206, "Partial Content", headers,
                        new ByteArrayInputStream(audio, start, length));
                }
            } catch (NumberFormatException ignored) {
                // Odpowiedz 416, gdy nagłówek zawiera liczbę spoza obsługiwanego zakresu.
            }
        }
        headers.put("Content-Range", "bytes */" + audio.length);
        return response(416, "Range Not Satisfiable", headers);
    }

    @Override
    protected void onActivityResult(int code, int result, Intent intent) {
        super.onActivityResult(code, result, intent);
        if (code != PICK_AUDIO || fileCallback == null) return;
        Uri[] files = null;
        if (result == RESULT_OK && intent != null) {
            if (intent.getClipData() != null) {
                files = new Uri[intent.getClipData().getItemCount()];
                for (int i = 0; i < files.length; i++) files[i] = intent.getClipData().getItemAt(i).getUri();
            } else if (intent.getData() != null) {
                files = new Uri[]{intent.getData()};
            }
        }
        fileCallback.onReceiveValue(files);
        fileCallback = null;
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        web.destroy();
        super.onDestroy();
    }
}
