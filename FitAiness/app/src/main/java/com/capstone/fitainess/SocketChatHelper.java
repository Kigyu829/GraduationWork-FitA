package com.capstone.fitainess;

import android.util.Log;

import org.json.JSONObject;

import io.socket.client.IO;
import io.socket.client.Socket;

/**
 * Socket.io 기반 AI 채팅 스트리밍 헬퍼
 *
 * 서버 이벤트:
 *   chat_token  (String)  — 스트리밍 토큰
 *   chat_done   (Object)  — { reply, action, reason }
 *   chat_error  (String)  — 오류 메시지
 *
 * 클라이언트 이벤트:
 *   chat_message (Object) — { message, userInfo, mealPlan, workoutPlan, recentHistory }
 */
public class SocketChatHelper
{
    private static final String TAG = "SocketChatHelper";

    // 에뮬레이터: 10.0.2.2  / 실기기: 서버 PC 실제 IP
    private static final String AI_SERVER = "http://10.0.2.2:5000";
    // private static final String AI_SERVER = "http://192.168.0.x:5000";

    private Socket socket;

    // ── 스트리밍 콜백 인터페이스 ─────────────────────────────
    public interface StreamCallback
    {
        void onToken(String token);
        void onDone(String reply, String action, String reason);
        void onError(String error);
    }

    public SocketChatHelper()
    {
        try {
            IO.Options opts = IO.Options.builder()
                    .setTransports(new String[]{ "websocket", "polling" })
                    .setReconnection(true)
                    .setReconnectionAttempts(3)
                    .build();
            socket = IO.socket(AI_SERVER, opts);
            socket.on(Socket.EVENT_CONNECT,
                    args -> Log.i(TAG, "AI 소켓 연결됨"));
            socket.on(Socket.EVENT_CONNECT_ERROR,
                    args -> Log.w(TAG, "AI 소켓 연결 실패: " + (args.length > 0 ? args[0] : "")));
            socket.connect();
        } catch (Exception e) {
            Log.e(TAG, "Socket 초기화 실패", e);
        }
    }

    /**
     * AI 채팅 스트리밍 전송
     *
     * @param message        사용자 메시지
     * @param userInfo       사용자 정보 문자열
     * @param mealPlanJson   현재 식단 플랜 JSON (없으면 null)
     * @param workoutPlanJson 현재 운동 플랜 JSON (없으면 null)
     * @param recentHistory  최근 대화 기록 문자열 (없으면 null)
     * @param callback       스트리밍 콜백
     */
    public void streamChat(String message, String userInfo,
                           String mealPlanJson, String workoutPlanJson,
                           String recentHistory, StreamCallback callback)
    {
        if (socket == null || !socket.connected()) {
            callback.onError("AI 서버에 연결되지 않았습니다. 잠시 후 다시 시도해주세요.");
            return;
        }

        // 이전 리스너 정리
        socket.off("chat_token");
        socket.off("chat_done");
        socket.off("chat_error");

        // 토큰 수신
        socket.on("chat_token", args -> {
            if (args.length > 0 && args[0] instanceof String)
                callback.onToken((String) args[0]);
        });

        // 완료 수신
        socket.on("chat_done", args -> {
            try {
                if (args.length == 0) { callback.onDone("", null, null); return; }
                JSONObject data = (JSONObject) args[0];
                String reply  = data.optString("reply", "");
                String action = data.optString("action", null);
                String reason = data.optString("reason", null);
                if ("null".equals(action)) action = null;
                if ("null".equals(reason)) reason = null;
                callback.onDone(reply, action, reason);
            } catch (Exception e) {
                callback.onError("응답 파싱 실패: " + e.getMessage());
            } finally {
                socket.off("chat_token");
                socket.off("chat_done");
                socket.off("chat_error");
            }
        });

        // 오류 수신
        socket.on("chat_error", args -> {
            String err = (args.length > 0 && args[0] instanceof String)
                    ? (String) args[0] : "알 수 없는 오류";
            callback.onError(err);
            socket.off("chat_token");
            socket.off("chat_done");
            socket.off("chat_error");
        });

        // 메시지 전송
        try {
            JSONObject payload = new JSONObject();
            payload.put("message", message);
            if (userInfo != null)       payload.put("userInfo", userInfo);
            if (mealPlanJson != null)   payload.put("mealPlan",    new JSONObject(mealPlanJson));
            if (workoutPlanJson != null) payload.put("workoutPlan", new JSONObject(workoutPlanJson));
            if (recentHistory != null)  payload.put("recentHistory", recentHistory);
            socket.emit("chat_message", payload);
        } catch (Exception e) {
            callback.onError("메시지 전송 실패: " + e.getMessage());
        }
    }

    /** 소켓 연결 해제 (Fragment onDestroyView에서 호출) */
    public void disconnect()
    {
        if (socket != null) {
            socket.off();
            socket.disconnect();
        }
    }
}
