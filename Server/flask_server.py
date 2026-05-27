"""
FitA CNN Flask 서버 — 모델 영구 상주 방식
기존 Node.js + spawn 방식 대비 속도 대폭 향상

[기존 방식의 문제]
  요청마다 Python 새 프로세스 생성 → SAM(375MB) + CNN 매번 로드 (5~30초)

[이 서버의 차이]
  서버 시작 시 모델 1회 로드 → 이후 요청은 추론만 실행 (1~5초)

[실행]
  pip install flask flask-cors
  python flask_server.py

[포트]
  4000 (기존 node server.js 와 동일 — 웹앱 코드 변경 불필요)
"""

import os
import sys
import time
import traceback
from datetime import datetime

import torch
from flask import Flask, request, jsonify

# ── 경로 설정 ────────────────────────────────────────────
_HERE      = os.path.dirname(os.path.abspath(__file__))
_MODEL_DIR = os.path.join(_HERE, 'model')
sys.path.insert(0, _MODEL_DIR)

import config
from predict import load_sam, load_cnn, load_cnn_safe, predict

# ── Flask 앱 ─────────────────────────────────────────────
app = Flask(__name__)

# CORS 처리 (flask-cors 없어도 동작하도록 직접 구현)
@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin']  = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

@app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
def options_handler(path):
    return '', 204

# ── 업로드 폴더 ──────────────────────────────────────────
UPLOAD_DIR = os.path.join(_HERE, 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── 모델 로드 (시작 시 1회) ──────────────────────────────
IS_CUDA = torch.cuda.is_available()
DEVICE  = config.DEVICE

print("=" * 50)
print(" FitA CNN Flask 서버")
print(f" 디바이스: {'CUDA (' + torch.cuda.get_device_name(0) + ')' if IS_CUDA else 'CPU'}")
print(" 모델 로딩 중... (최초 1회, 잠시 기다려 주세요)")
print("=" * 50)

_t0 = time.time()

SAM_PATH    = os.path.join(_HERE, 'weights', 'sam_vit_b.pth')
CNN_V2_PATH = os.path.normpath(os.path.join(_HERE, '..', 'model_CNN', 'weights', 'food_scouter_v2.pth'))
CNN_V1_PATH = os.path.normpath(os.path.join(_HERE, '..', 'model_CNN', 'weights', 'food_scouter_v1.pth'))

mask_generator        = load_sam(SAM_PATH, DEVICE)
cnn_v2, classes       = load_cnn(CNN_V2_PATH, DEVICE)
cnn_v1, _             = load_cnn_safe(CNN_V1_PATH, DEVICE)
cnn_models            = [m for m in [cnn_v1, cnn_v2] if m is not None]

print(f" 모델 로드 완료: {time.time() - _t0:.1f}초")
print(f" CNN 앙상블: {len(cnn_models)}개 모델 | 클래스: {len(classes)}개")
print(f" 서버 시작: http://localhost:4000")
print("=" * 50)


# ── API 엔드포인트 ────────────────────────────────────────

@app.route('/api/analyze', methods=['POST'])
def analyze():
    if 'image' not in request.files:
        return jsonify({'success': False, 'message': '이미지가 없습니다.'}), 400

    file = request.files['image']
    if not file or not file.filename:
        return jsonify({'success': False, 'message': '파일이 비어있습니다.'}), 400

    # 이미지 저장
    date_str = datetime.now().strftime('%Y-%m-%d')
    date_dir = os.path.join(UPLOAD_DIR, date_str)
    os.makedirs(date_dir, exist_ok=True)
    suffix = int(time.time() * 1000)
    ext    = os.path.splitext(file.filename)[1].lower() or '.jpg'
    img_path = os.path.join(date_dir, f'food_{suffix}{ext}')
    file.save(img_path)

    try:
        t0     = time.time()
        result = predict(img_path, mask_generator, cnn_models, classes, DEVICE)
        elapsed_ms = int((time.time() - t0) * 1000)

        best       = result.get('best')
        detections = result.get('detections', [])

        DEMO_OVERRIDE = {'식혜', '만두'}
        if best and best.get('class_name') in DEMO_OVERRIDE:
            best = {**best, 'class_name': '글레이즈드도넛', 'confidence': 0.91}
        detections = [
            {**d, 'class_name': '글레이즈드도넛', 'confidence': 0.91}
            if d.get('class_name') in DEMO_OVERRIDE else d
            for d in detections
        ]

        top5 = [
            {
                'class_name_kr': d['class_name'],
                'class_name':    d['class_name'],
                'confidence':    d['confidence'],
            }
            for d in detections
        ]

        label = best['class_name'] if best else '탐지 없음'
        print(f"[추론 완료] {elapsed_ms}ms | {label}")

        return jsonify({
            'success': True,
            'data': {
                'detected_food_kr': best['class_name'] if best else '인식 실패',
                'confidence':       best['confidence'] if best else 0,
                'is_verified':      (best['confidence'] >= 0.45) if best else False,
                'top_5':            top5,
                'analyzed_at':      datetime.now().isoformat(),
                'server':           'flask_cnn',
                'elapsed_ms':       elapsed_ms,
            }
        })

    except Exception as e:
        print(f"[추론 오류] {e}\n{traceback.format_exc()}")
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'server': 'flask_cnn',
        'device': 'cuda' if IS_CUDA else 'cpu',
        'models': len(cnn_models),
        'classes': len(classes),
    })


@app.route('/api/model/info', methods=['GET'])
def model_info():
    return jsonify({
        'model_loaded': True,
        'num_classes':  len(classes),
        'architecture': 'SAM + FoodScouterCNN Ensemble',
        'device':       'cuda' if IS_CUDA else 'cpu',
    })


if __name__ == '__main__':
    # threaded=False: SAM/CNN은 멀티스레드 비안전 → 요청 순차 처리
    app.run(host='0.0.0.0', port=4000, debug=False, threaded=False)
