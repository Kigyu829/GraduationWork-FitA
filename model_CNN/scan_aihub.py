"""
AI Hub 데이터 폴더 구조 파악 스크립트
실행: python scan_aihub.py
"""

import os
import json

# ── 설정 ──────────────────────────────────────────
AIHUB_DIR = r"C:\Users\김인규\Desktop\새 폴더"
# ──────────────────────────────────────────────────

# 우리 150종 한국어 이름 (config.js의 FOOD_LABELS 기준)
OUR_LABELS = {
    "가지볶음", "간장게장", "갈비구이", "갈비찜", "갈비탕", "갈치구이", "갈치조림",
    "감자전", "감자조림", "감자채볶음", "감자탕", "갓김치", "건새우볶음", "경단",
    "계란국", "계란말이", "계란찜", "계란후라이", "고등어구이", "고등어조림",
    "고사리나물", "고추장진미채볶음", "고추튀김", "곰탕", "설렁탕", "곱창구이",
    "곱창전골", "과메기", "김밥", "김치볶음밥", "김치전", "김치찌개", "김치찜",
    "깍두기", "깻잎장아찌", "꼬막찜", "꽁치조림", "꽈리고추무침", "꿀떡",
    "나박김치", "누룽지", "닭갈비", "닭계장", "닭볶음탕", "더덕구이", "도라지무침",
    "도토리묵", "동그랑땡", "동태찌개", "된장찌개", "두부김치", "두부조림",
    "땅콩조림", "떡갈비", "떡국", "만두국", "떡꼬치", "떡볶이", "라면", "라볶이",
    "막국수", "만두", "매운탕", "멍게", "메추리알장조림", "멸치볶음", "무국",
    "무생채", "물냉면", "물회", "미역국", "미역줄기볶음", "배추김치", "백김치",
    "보쌈", "부추김치", "북엇국", "불고기", "비빔냉면", "비빔밥", "산낙지",
    "삼겹살", "삼계탕", "새우볶음밥", "새우튀김", "생선전", "소세지볶음", "송편",
    "수육", "수정과", "수제비", "숙주나물", "순대", "순두부찌개", "시금치나물",
    "시래기국", "식혜", "알밥", "애호박볶음", "약과", "약식", "양념게장",
    "양념치킨", "어묵볶음", "연근조림", "열무국수", "열무김치", "오이소박이",
    "오징어채볶음", "오징어튀김", "우엉조림", "유부초밥", "육개장", "육회",
    "잔치국수", "잡곡밥", "잡채", "장어구이", "장조림", "전복죽", "젓갈",
    "제육볶음", "조개구이", "조기구이", "족발", "주꾸미볶음", "주먹밥", "짜장면",
    "짬뽕", "쫄면", "찜닭", "총각김치", "추어탕", "칼국수", "코다리조림",
    "콩국수", "콩나물국", "콩나물무침", "콩자반", "파김치", "파전", "편육",
    "피자", "한과", "해물찜", "호박전", "호박죽", "홍어무침", "황태구이",
    "회무침", "후라이드치킨", "훈제오리"
}

def scan():
    print(f"스캔 경로: {AIHUB_DIR}\n")

    if not os.path.exists(AIHUB_DIR):
        print("❌ 경로가 존재하지 않습니다. AIHUB_DIR 경로를 확인하세요.")
        return

    # 1단계: 최상위 폴더 구조 출력
    print("=" * 50)
    print("📁 최상위 폴더 구조")
    print("=" * 50)
    top_items = os.listdir(AIHUB_DIR)
    for item in sorted(top_items):
        full_path = os.path.join(AIHUB_DIR, item)
        if os.path.isdir(full_path):
            sub_count = len(os.listdir(full_path))
            print(f"  📂 {item}/ ({sub_count}개 항목)")
        else:
            print(f"  📄 {item}")

    # 2단계: 모든 폴더명 수집
    print("\n" + "=" * 50)
    print("📋 전체 폴더명 목록 (음식 카테고리 탐색)")
    print("=" * 50)

    all_folders = set()
    for root, dirs, files in os.walk(AIHUB_DIR):
        for d in dirs:
            all_folders.add(d)

    print(f"총 폴더 수: {len(all_folders)}개\n")

    # 3단계: 우리 150종과 매칭
    matched = []
    not_matched = []

    for folder in sorted(all_folders):
        # 완전 일치
        if folder in OUR_LABELS:
            matched.append(folder)
        else:
            # 부분 일치 (폴더명이 우리 라벨을 포함하거나 그 반대)
            partial = [label for label in OUR_LABELS
                      if label in folder or folder in label]
            if partial:
                matched.append(f"{folder} → {partial[0]} 유사")

    print(f"✅ 매칭된 폴더: {len(matched)}개")
    for m in sorted(matched):
        print(f"   - {m}")

    # 4단계: 샘플 JSON 구조 출력 (어노테이션 형식 파악)
    print("\n" + "=" * 50)
    print("📄 JSON 어노테이션 샘플 (첫 번째 발견된 JSON)")
    print("=" * 50)
    for root, dirs, files in os.walk(AIHUB_DIR):
        for f in files:
            if f.endswith('.json'):
                json_path = os.path.join(root, f)
                try:
                    with open(json_path, 'r', encoding='utf-8') as jf:
                        data = json.load(jf)
                    print(f"파일: {json_path}")
                    print(json.dumps(data, ensure_ascii=False, indent=2)[:1000])
                    print("... (최대 1000자 출력)")
                except:
                    pass
                print()
                break
        else:
            continue
        break

if __name__ == "__main__":
    scan()
