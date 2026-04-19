package com.capstone.fitainess;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.util.AttributeSet;
import android.view.View;

import com.google.mediapipe.tasks.components.containers.NormalizedLandmark;
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult;

import java.util.List;

/**
 * MediaPipe PoseLandmarker 결과를 화면에 그리는 커스텀 View
 * - 랜드마크 점: 녹색 원
 * - 뼈대 연결선: 흰색 선
 */
public class PoseOverlayView extends View
{
    private PoseLandmarkerResult results;
    private int imageWidth  = 1;
    private int imageHeight = 1;

    private final Paint dotPaint;
    private final Paint linePaint;

    // MediaPipe Pose 33개 랜드마크 연결 (인덱스 쌍)
    private static final int[][] POSE_CONNECTIONS = {
        // 얼굴
        {0,1},{1,2},{2,3},{3,7},{0,4},{4,5},{5,6},{6,8},{9,10},
        // 상체
        {11,12},{11,13},{13,15},{15,17},{15,19},{15,21},{17,19},
        {12,14},{14,16},{16,18},{16,20},{16,22},{18,20},
        // 몸통
        {11,23},{12,24},{23,24},
        // 하체
        {23,25},{24,26},{25,27},{26,28},
        {27,29},{28,30},{29,31},{30,32},{27,31},{28,32}
    };

    public PoseOverlayView(Context context) { this(context, null); }

    public PoseOverlayView(Context context, AttributeSet attrs)
    {
        super(context, attrs);

        dotPaint = new Paint();
        dotPaint.setColor(Color.GREEN);
        dotPaint.setStyle(Paint.Style.FILL);
        dotPaint.setAntiAlias(true);

        linePaint = new Paint();
        linePaint.setColor(Color.WHITE);
        linePaint.setStyle(Paint.Style.STROKE);
        linePaint.setStrokeWidth(4f);
        linePaint.setAntiAlias(true);
    }

    public void setResults(PoseLandmarkerResult results, int imgWidth, int imgHeight)
    {
        this.results     = results;
        this.imageWidth  = imgWidth;
        this.imageHeight = imgHeight;
        invalidate();
    }

    public void clearResults()
    {
        this.results = null;
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas)
    {
        super.onDraw(canvas);
        if (results == null || results.landmarks().isEmpty()) return;

        List<NormalizedLandmark> landmarks = results.landmarks().get(0);
        float scaleX = (float) getWidth()  / imageWidth;
        float scaleY = (float) getHeight() / imageHeight;

        // 연결선 그리기
        for (int[] conn : POSE_CONNECTIONS) {
            if (conn[0] >= landmarks.size() || conn[1] >= landmarks.size()) continue;
            NormalizedLandmark a = landmarks.get(conn[0]);
            NormalizedLandmark b = landmarks.get(conn[1]);
            canvas.drawLine(
                    a.x() * imageWidth  * scaleX,
                    a.y() * imageHeight * scaleY,
                    b.x() * imageWidth  * scaleX,
                    b.y() * imageHeight * scaleY,
                    linePaint
            );
        }

        // 랜드마크 점 그리기
        for (NormalizedLandmark lm : landmarks) {
            canvas.drawCircle(
                    lm.x() * imageWidth  * scaleX,
                    lm.y() * imageHeight * scaleY,
                    8f,
                    dotPaint
            );
        }
    }
}
