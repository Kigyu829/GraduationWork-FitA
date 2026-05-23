package com.capstone.fitainess;

/**
 * FitAiNess 서버 주소 중앙 관리
 *
 * 사용 시나리오:
 *   - 에뮬레이터(로컬):  BASE_URL = "http://10.0.2.2:3000"
 *   - 실기기 + 같은 WiFi: BASE_URL = "http://192.168.0.x:3000"  (PC IP 확인 후 입력)
 *   - 외부 접속 (데모):  BASE_URL = Cloudflare Tunnel URL
 *
 * Cloudflare Tunnel 사용법:
 *   1. start_all.bat 실행 (Graduation_Work 폴더)
 *   2. "Cloudflare Tunnel" 창에서 https://xxxx.trycloudflare.com 확인
 *   3. 아래 BASE_URL 을 해당 URL 로 변경 후 앱 재빌드
 *
 * 모든 API 경로는 웹 서버(포트 3000) 프록시를 통해 전달됨:
 *   /api/*   → AI  서버 :5000
 *   /cnn/*   → CNN 서버 :4000
 */
public class AppConfig {

    // ★ 서버 주소 — 여기 한 곳만 변경하면 앱 전체에 적용됨
    // 아래 3줄 중 하나만 주석 해제해서 사용

    // [발표/외부 데모] start_all.bat 실행 후 Cloudflare 창의 URL 복사
    // public static final String BASE_URL = "https://xxxx.trycloudflare.com";

    // [실기기 + 같은 Wi-Fi] cmd에서 ipconfig → IPv4 주소 확인
    // public static final String BASE_URL = "http://192.168.0.x:3000";

    // [에뮬레이터 전용]
    public static final String BASE_URL = "http://10.0.2.2:3000";

    // AI 서버 API (프록시 통과)
    public static final String AI_URL  = BASE_URL;  // /api/... 경로 사용

    // CNN 서버 (프록시 통과)
    public static final String CNN_URL = BASE_URL;  // /cnn/api/analyze 경로 사용

    private AppConfig() {}  // 인스턴스화 방지
}
