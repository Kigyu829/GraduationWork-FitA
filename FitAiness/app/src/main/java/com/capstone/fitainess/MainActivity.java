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
import android.webkit.SslErrorHandler;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.net.http.SslError;
import android.widget.Toast;

import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

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
    private GoogleSignInClient googleSignInClient;
    private String kakaoRedirectUri = null;
    private String kakaoPageUrl = null;

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

    /* ── 네이티브 Google Sign-In 결과 처리 ── */
    private final ActivityResultLauncher<Intent> googleSignInLauncher =
        registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            if (result.getResultCode() != RESULT_OK || result.getData() == null) return;
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(result.getData());
            try {
                GoogleSignInAccount account = task.getResult(ApiException.class);
                String idToken = account.getIdToken();
                if (idToken != null) {
                    final String js = "handleNativeGoogleToken('" + idToken + "')";
                    webView.post(() -> webView.evaluateJavascript(js, null));
                } else {
                    android.util.Log.e("GoogleSignIn", "idToken null — SHA-1 미등록 가능성");
                    final String errJs = "alert('구글 로그인 실패: Firebase Console에 SHA-1 지문을 등록하고 google-services.json을 재다운로드해 주세요.')";
                    webView.post(() -> webView.evaluateJavascript(errJs, null));
                }
            } catch (ApiException e) {
                android.util.Log.e("GoogleSignIn", "Sign-in failed: " + e.getStatusCode());
                final String errJs = "alert('구글 로그인 실패 (코드: " + e.getStatusCode() + ")')";
                webView.post(() -> webView.evaluateJavascript(errJs, null));
            }
        });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView     = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);

        setupWebView();
        setupGoogleSignIn();
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
       카카오 앱 → fitakakaocallback:// 콜백 수신
       ════════════════════════════════════════ */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        Uri data = intent.getData();
        if (data != null && "fitakakaocallback".equals(data.getScheme())) {
            String code  = data.getQueryParameter("code");
            String state = data.getQueryParameter("state");
            if (code != null && webView != null) {
                String target = (kakaoPageUrl != null) ? kakaoPageUrl
                              : AppConfig.BASE_URL + "/fita/pages/sc201_1.html";
                String callbackUrl = target + "?code=" + code
                        + (state != null ? "&state=" + state : "");
                webView.loadUrl(callbackUrl);
            }
        }
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

        /* Chrome DevTools 디버깅 */
        WebView.setWebContentsDebuggingEnabled(true);

        /* 네이티브 Google Sign-In 브리지 */
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        /* ── WebViewClient: 페이지 로딩 / URL 라우팅 ── */
        webView.setWebViewClient(new WebViewClient() {

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // YouTube 운동 동영상 링크 → 외부 브라우저
                if (url.contains("youtube.com") || url.contains("youtu.be")) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) {}
                    return true;
                }
                // Kakao 인증 페이지: redirect_uri·현재 페이지 저장 후 WebView 내에서 로드
                if (url.contains("kauth.kakao.com/oauth/authorize")) {
                    try {
                        Uri uri = Uri.parse(url);
                        kakaoRedirectUri = uri.getQueryParameter("redirect_uri");
                        kakaoPageUrl = view.getUrl();
                    } catch (Exception ignored) {}
                    return false;
                }
                // Kakao 앱 스킴 — code 없으면 카카오 앱 실행, code 있으면 WebView 콜백
                if (!url.startsWith("http") && url.startsWith("kakao")) {
                    try {
                        Uri kakaoUri = Uri.parse(url);
                        String code  = kakaoUri.getQueryParameter("code");
                        String state = kakaoUri.getQueryParameter("state");
                        if (code != null) {
                            // code 포함 → WebView 페이지로 콜백
                            String target = (kakaoPageUrl != null) ? kakaoPageUrl
                                          : AppConfig.BASE_URL + "/fita/pages/sc201_1.html";
                            String callbackUrl = target + "?code=" + code
                                    + (state != null ? "&state=" + state : "");
                            view.loadUrl(callbackUrl);
                        } else {
                            // code 없음 = 카카오 앱 실행 시도 URL
                            // 앱 실행 차단 → kauth.kakao.com이 웹 로그인 폼으로 폴백
                        }
                    } catch (Exception e) {
                        android.util.Log.e("Kakao", "Callback error: " + e.getMessage());
                    }
                    return true;
                }
                // 서버 내부 링크(BASE_URL 포함)는 WebView 내에서 처리
                if (url.startsWith(AppConfig.BASE_URL)) {
                    return false;
                }
                // 그 외 외부 링크 → 브라우저
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) {}
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                /* BASE_URL의 SSL 오류만 허용 (개발/터널 환경), 외부 URL은 거부 */
                String errorUrl = error.getUrl();
                if (errorUrl != null && errorUrl.startsWith(AppConfig.BASE_URL)) {
                    handler.proceed();
                } else {
                    handler.cancel();
                }
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
       네이티브 Google Sign-In 초기화
       ════════════════════════════════════════ */
    private void setupGoogleSignIn() {
        GoogleSignInOptions gso = new GoogleSignInOptions
                .Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(AppConfig.GOOGLE_WEB_CLIENT_ID)
                .requestEmail()
                .build();
        googleSignInClient = GoogleSignIn.getClient(this, gso);
    }

    /* ── WebView ↔ Android 브리지 ── */
    private class AndroidBridge {
        @android.webkit.JavascriptInterface
        public void signInWithGoogle() {
            runOnUiThread(() ->
                googleSignInClient.signOut().addOnCompleteListener(task ->
                    googleSignInLauncher.launch(googleSignInClient.getSignInIntent())
                )
            );
        }
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
