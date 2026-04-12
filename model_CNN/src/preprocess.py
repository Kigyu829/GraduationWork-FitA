"""
AI Hub 한국 음식 이미지 데이터셋 전처리 스크립트

AI Hub에서 다운로드한 데이터를 학습 가능한 형태로 정리합니다.

사용법:
  1. AI Hub (https://aihub.or.kr)에서 '한국 음식 이미지' 데이터셋 다운로드
  2. 압축 풀고 data/raw/ 폴더에 넣기
  3. python src/preprocess.py 실행

예상 디렉토리 구조 (AI Hub 데이터):
  data/raw/
    ├── 한식/
    │   ├── 비빔밥/
    │   │   ├── img001.jpg
    │   │   └── ...
    │   ├── 불고기/
    │   └── ...
    ├── 중식/
    ├── 일식/
    └── ...

전처리 후 결과:
  data/processed/
    ├── train/
    │   ├── bibimbap/
    │   ├── bulgogi/
    │   └── ...
    ├── val/
    ├── test/
    └── labels.json
"""

import os
import json
import shutil
import random
from collections import Counter
from pathlib import Path
from PIL import Image
from tqdm import tqdm

import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import config


# ══════════════════════════════════════════
# 한글 → 영문 클래스명 매핑 (AI Hub 기준)
# 실제 데이터셋의 폴더명에 맞게 수정하세요
# ══════════════════════════════════════════
KOREAN_TO_ENGLISH = {
    # 밥류
    "비빔밥": "bibimbap",
    "김치볶음밥": "kimchi_fried_rice",
    "볶음밥": "fried_rice",
    "카레라이스": "curry_rice",
    "김밥": "gimbap",
    "주먹밥": "rice_ball",
    "오므라이스": "omurice",
    "덮밥": "rice_bowl",
    "흰쌀밥": "white_rice",

    # 국/탕/찌개류
    "김치찌개": "kimchi_jjigae",
    "된장찌개": "doenjang_jjigae",
    "순두부찌개": "sundubu_jjigae",
    "부대찌개": "budae_jjigae",
    "미역국": "miyeok_guk",
    "콩나물국": "kongnamul_guk",
    "갈비탕": "galbitang",
    "삼계탕": "samgyetang",
    "설렁탕": "seolleongtang",
    "떡국": "tteokguk",
    "육개장": "yukgaejang",
    "감자탕": "gamjatang",
    "추어탕": "chueotang",
    "매운탕": "maeuntang",

    # 면류
    "라면": "ramyeon",
    "자장면": "jajangmyeon",
    "짬뽕": "jjamppong",
    "냉면": "naengmyeon",
    "칼국수": "kalguksu",
    "잔치국수": "janchi_guksu",
    "비빔국수": "bibim_guksu",
    "쌀국수": "rice_noodle",
    "파스타": "pasta",
    "우동": "udon",

    # 고기류
    "불고기": "bulgogi",
    "삼겹살": "samgyeopsal",
    "갈비": "galbi",
    "닭갈비": "dakgalbi",
    "제육볶음": "jeyuk_bokkeum",
    "족발": "jokbal",
    "보쌈": "bossam",
    "닭볶음탕": "dak_bokkeum",
    "돈까스": "donkatsu",
    "탕수육": "tangsuyuk",
    "스테이크": "steak",
    "치킨": "fried_chicken",

    # 해산물류
    "생선구이": "grilled_fish",
    "회": "sashimi",
    "새우튀김": "fried_shrimp",
    "해물파전": "haemul_pajeon",
    "조개구이": "grilled_clam",
    "오징어볶음": "ojingeo_bokkeum",
    "생선조림": "braised_fish",

    # 반찬류
    "김치": "kimchi",
    "잡채": "japchae",
    "계란말이": "gyeran_mari",
    "계란찜": "gyeran_jjim",
    "두부조림": "braised_tofu",
    "멸치볶음": "myeolchi_bokkeum",
    "시금치나물": "spinach_namul",
    "콩나물무침": "kongnamul_muchim",
    "감자조림": "braised_potato",
    "어묵볶음": "eomuk_bokkeum",

    # 전/부침류
    "전": "jeon",
    "김치전": "kimchi_jeon",
    "감자전": "gamja_jeon",
    "녹두전": "nokdu_jeon",
    "부추전": "buchu_jeon",

    # 분식류
    "떡볶이": "tteokbokki",
    "순대": "sundae",
    "만두": "mandu",
    "튀김": "twigim",
    "핫도그": "hotdog",
    "토스트": "toast",

    # 빵/디저트류
    "빵": "bread",
    "케이크": "cake",
    "과일": "fruit",
    "샐러드": "salad",
    "요거트": "yogurt",
    "시리얼": "cereal",
    "고구마": "sweet_potato",
    "옥수수": "corn",

    # 음료
    "커피": "coffee",
    "주스": "juice",

    # 일식
    "초밥": "sushi",
    "라멘": "ramen",
    "돈부리": "donburi",
    "타코야키": "takoyaki",

    # 중식
    "마파두부": "mapo_tofu",
    "깐풍기": "kkanpunggi",
    "양장피": "yangjangpi",

    # 양식
    "피자": "pizza",
    "햄버거": "hamburger",
    "샌드위치": "sandwich",
    "스프": "soup",
    "그라탕": "gratin",
    "리조또": "risotto",

    # 건강식
    "닭가슴살": "chicken_breast",
    "프로틴쉐이크": "protein_shake",
    "현미밥": "brown_rice",
}


def find_image_files(root_dir):
    """
    AI Hub 데이터 디렉토리에서 이미지 파일을 재귀적으로 탐색
    Returns: [(image_path, class_name_korean), ...]
    """
    image_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    samples = []

    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if Path(file).suffix.lower() in image_extensions:
                filepath = os.path.join(root, file)
                # 상위 폴더명을 클래스명으로 사용
                class_name = os.path.basename(root)
                samples.append((filepath, class_name))

    return samples


def validate_image(filepath):
    """이미지 파일이 유효한지 확인"""
    try:
        with Image.open(filepath) as img:
            img.verify()
        # verify() 후 다시 열어서 실제 로드 가능한지 확인
        with Image.open(filepath) as img:
            img.load()
        return True
    except Exception:
        return False


def preprocess():
    """메인 전처리 함수"""
    print("=" * 60)
    print("  AI Hub 한국 음식 데이터셋 전처리")
    print("=" * 60)

    # 1. 원본 데이터 탐색
    print("\n[1/5] 원본 데이터 탐색 중...")
    raw_dir = config.RAW_DIR

    if not os.path.exists(raw_dir) or not os.listdir(raw_dir):
        print(f"\n❌ 데이터가 없습니다!")
        print(f"   AI Hub에서 데이터셋을 다운로드한 후")
        print(f"   '{raw_dir}' 폴더에 넣어주세요.")
        print(f"\n   다운로드: https://aihub.or.kr")
        print(f"   검색어: '한국 음식 이미지'")
        return

    samples = find_image_files(raw_dir)
    print(f"   총 {len(samples)}개 이미지 발견")

    # 2. 클래스별 통계
    print("\n[2/5] 클래스별 통계 분석 중...")
    class_counts = Counter([s[1] for s in samples])
    print(f"   총 {len(class_counts)}개 클래스 발견")

    # 최소 샘플 수 미달 클래스 필터링
    valid_classes = {
        cls for cls, count in class_counts.items()
        if count >= config.MIN_SAMPLES_PER_CLASS
    }
    filtered_samples = [(p, c) for p, c in samples if c in valid_classes]

    excluded = len(class_counts) - len(valid_classes)
    if excluded > 0:
        print(f"   ⚠️  {excluded}개 클래스 제외 (샘플 {config.MIN_SAMPLES_PER_CLASS}개 미만)")
    print(f"   유효 클래스: {len(valid_classes)}개, 유효 이미지: {len(filtered_samples)}개")

    # 3. 영문 라벨 매핑
    print("\n[3/5] 라벨 매핑 생성 중...")
    label_mapping = {}
    unmapped = []
    idx = 0

    for cls_name in sorted(valid_classes):
        if cls_name in KOREAN_TO_ENGLISH:
            eng_name = KOREAN_TO_ENGLISH[cls_name]
        else:
            # 매핑이 없으면 원본 이름 사용 (경고 출력)
            eng_name = cls_name.replace(" ", "_").lower()
            unmapped.append(cls_name)

        label_mapping[cls_name] = {
            "index": idx,
            "english": eng_name,
            "korean": cls_name,
        }
        idx += 1

    if unmapped:
        print(f"   ⚠️  영문 매핑 없는 클래스 {len(unmapped)}개:")
        for name in unmapped[:10]:
            print(f"      - {name}")
        if len(unmapped) > 10:
            print(f"      ... 외 {len(unmapped) - 10}개")

    # 4. Train/Val/Test 분할
    print("\n[4/5] 데이터 분할 중...")
    processed_dir = config.PROCESSED_DIR

    # 기존 데이터 삭제
    for split in ["train", "val", "test"]:
        split_dir = os.path.join(processed_dir, split)
        if os.path.exists(split_dir):
            shutil.rmtree(split_dir)

    split_counts = {"train": 0, "val": 0, "test": 0}

    for cls_name in tqdm(sorted(valid_classes), desc="   분할"):
        cls_samples = [p for p, c in filtered_samples if c == cls_name]
        random.shuffle(cls_samples)

        n = len(cls_samples)
        n_train = int(n * config.TRAIN_RATIO)
        n_val = int(n * config.VAL_RATIO)

        splits = {
            "train": cls_samples[:n_train],
            "val": cls_samples[n_train:n_train + n_val],
            "test": cls_samples[n_train + n_val:],
        }

        eng_name = label_mapping[cls_name]["english"]

        for split_name, split_files in splits.items():
            dest_dir = os.path.join(processed_dir, split_name, eng_name)
            os.makedirs(dest_dir, exist_ok=True)

            for i, src_path in enumerate(split_files):
                if validate_image(src_path):
                    ext = Path(src_path).suffix.lower()
                    dest_path = os.path.join(dest_dir, f"{eng_name}_{i:04d}{ext}")
                    shutil.copy2(src_path, dest_path)
                    split_counts[split_name] += 1

    # 5. labels.json 저장
    print("\n[5/5] 라벨 파일 저장 중...")

    # Node.js 서버용 labels.json (index → english)
    server_labels = {}
    for cls_info in label_mapping.values():
        server_labels[str(cls_info["index"])] = cls_info["english"]

    labels_path = os.path.join(processed_dir, "labels.json")
    with open(labels_path, "w", encoding="utf-8") as f:
        json.dump(server_labels, f, ensure_ascii=False, indent=2)

    # 상세 매핑 저장 (한글 포함)
    detail_labels_path = os.path.join(processed_dir, "labels_detail.json")
    with open(detail_labels_path, "w", encoding="utf-8") as f:
        json.dump(label_mapping, f, ensure_ascii=False, indent=2)

    # 결과 출력
    print("\n" + "=" * 60)
    print("  전처리 완료!")
    print("=" * 60)
    print(f"  클래스 수:  {len(valid_classes)}")
    print(f"  Train:      {split_counts['train']}장")
    print(f"  Validation: {split_counts['val']}장")
    print(f"  Test:       {split_counts['test']}장")
    print(f"  총합:       {sum(split_counts.values())}장")
    print(f"\n  저장 위치:  {processed_dir}")
    print(f"  라벨 파일:  {labels_path}")
    print("=" * 60)


if __name__ == "__main__":
    random.seed(42)
    preprocess()
