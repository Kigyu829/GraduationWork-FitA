package com.capstone.fitainess;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

/**
 * FitAiness WebView 메인 액티비티
 *
 * FitA 웹앱(FitA/webapp/)을 WebView 로 감싼 하이브리드 앱.
 * 서버 주소는 AppConfig.BASE_URL 한 곳에서 관리.
 *
 * 주요 기능:
 *   - JavaScript / DOM Storage 활성화
 *   - 카메라 권한 (MediaPipe 자세 분석)
 *   - 파일 선택 (식단 사진 업로드)
 *   - YouTube 외부 링크 → 기본 브라우저 열기
 *   - 서버 연결 실패 시 오프라인 안내 페이지
 *   - 하드웨어 뒤로가기 → WebView 히스토리 이동
 */
public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> fileChooserCallback;
    private long backPressedTime = 0;

    /* ── 파일 선택 결과 처리 (식단 사진 업로드) ── */
    private final ActivityResultLauncher<Intent> fileChooserLauncher =
        registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            if (fileChooserCallback == null) return;
            Uri[] results = null;
            if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                results = new Uri[]{ result.getData().getData() };
            }
            fileChooserCallback.onReceiveValue(results);
            fileChooserCallback = null;
        });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView     = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);

        setupWebView();
        requestCameraPermission();

        // 뒤로가기 처리 (제스처 내비게이션 포함)
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    long now = System.currentTimeMillis();
                    if (now - backPressedTime < 2000) {
                        finish();
                    } else {
                        backPressedTime = now;
                        Toast.makeText(MainActivity.this, "한 번 더 누르면 종료됩니다", Toast.LENGTH_SHORT).show();
                    }
                }
            }
        });

        // FitA 웹앱 로드
        webView.loadUrl(AppConfig.BASE_URL + "/fita/");
    }

    /* ════════════════════════════════════════
       WebView 설정
       ════════════════════════════════════════ */
    private void setupWebView() {
        WebSettings s = webView.getSettings();

        /* 기본 기능 */
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setDisplayZoomControls(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " FitAiness/1.0");

        /* 쿠키 */
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        /* Chrome DevTools 디버깅 (빌드 후 제거 권장) */
        WebView.setWebContentsDebuggingEnabled(true);

        /* ── WebViewClient: 페이지 로딩 / URL 라우팅 ── */
        webView.setWebViewClient(new WebViewClient() {

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // YouTube 운동 동영상 링크 → 외부 브라우저
                if (url.contains("youtube.com") || url.contains("youtu.be")) {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    return true;
                }
                // 서버 내부 링크(BASE_URL 포함)는 WebView 내에서 처리
                if (url.startsWith(AppConfig.BASE_URL)) {
                    return false;
                }
                // 그 외 외부 링크 → 브라우저
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        WebResourceError error) {
                // 메인 프레임 로드 실패 시 오프라인 안내 페이지 표시
                if (request.isForMainFrame()) {
                    view.loadDataWithBaseURL(null, buildOfflinePage(),
                            "text/html; charset=utf-8", "UTF-8", null);
                }
            }
        });

        /* ── WebChromeClient: 진행바 / 카메라 권한 / 파일 선택 ── */
        webView.setWebChromeClient(new WebChromeClient() {

            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                    progressBar.setProgress(newProgress);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }

            /* MediaPipe 카메라 권한 요청 자동 허용 */
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                request.grant(request.getResources());
            }

            /* 식단 사진 업로드 파일 선택 */
            @Override
            public boolean onShowFileChooser(WebView webView,
                                             ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                if (fileChooserCallback != null) {
                    fileChooserCallback.onReceiveValue(null);
                }
                fileChooserCallback = filePathCallback;
                try {
                    fileChooserLauncher.launch(fileChooserParams.createIntent());
                } catch (Exception e) {
                    fileChooserCallback = null;
                    return false;
                }
                return true;
            }
        });
    }

    /* ════════════════════════════════════════
       카메라 런타임 권한 요청
       ════════════════════════════════════════ */
    private void requestCameraPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                    new String[]{ Manifest.permission.CAMERA }, 100);
        }
    }

    /* ════════════════════════════════════════
       서버 연결 실패 안내 페이지 (인라인 HTML)
       ════════════════════════════════════════ */
    private String buildOfflinePage() {
        return "<!DOCTYPE html><html lang='ko'><head>"
            + "<meta charset='UTF-8'>"
            + "<meta name='viewport' content='width=device-width,initial-scale=1'>"
            + "<style>"
            + "body{margin:0;background:#09131A;color:#94a3b8;font-family:'Noto Sans KR',sans-serif;"
            + "display:flex;flex-direction:column;align-items:center;justify-content:center;"
            + "height:100vh;text-align:center;padding:24px;box-sizing:border-box;}"
            + "h1{color:#66D0BC;font-size:22px;margin:0 0 12px;}"
            + "p{font-size:14px;line-height:1.7;margin:4px 0;}"
            + ".url{color:#66D0BC;font-weight:700;word-break:break-all;}"
            + ".hint{margin-top:16px;font-size:12px;color:#475569;line-height:1.8;}"
            + ".btn{margin-top:24px;padding:12px 28px;background:#66D0BC;color:#09131A;"
            + "border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;}"
            + "</style></head><body>"
            + "<h1>🔌 서버에 연결할 수 없어요</h1>"
            + "<p>서버가 실행 중인지 확인해주세요.</p>"
            + "<p class='url'>" + AppConfig.BASE_URL + "</p>"
            + "<div class='hint'>"
            + "에뮬레이터 → <b>10.0.2.2:3000</b><br>"
            + "실기기(같은 Wi-Fi) → <b>PC의 로컬 IP:3000</b><br>"
            + "외부 접속 → <b>Cloudflare Tunnel URL</b>"
            + "</div>"
            + "<button class='btn' onclick='location.reload()'>🔄 다시 시도</button>"
            + "</body></html>";
    }
}
