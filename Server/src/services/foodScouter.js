const { spawn } = require("child_process");
const path = require("path");

/**
 * Food Scouter 서비스
 * Node.js에서 Python CNN 모델을 호출하여 음식 이미지를 분류합니다.
 *
 * 흐름: Android → Node.js API → Python CNN 추론 → 결과 반환
 */
class FoodScouterService {
  constructor() {
    this.pythonPath = process.env.PYTHON_PATH || "python3";
    this.scriptPath = path.join(__dirname, "../../model/predict.py");
    this.modelPath =
      process.env.CNN_MODEL_PATH || "./model/weights/food_scouter_v1.pth";
    this.labelsPath = path.join(__dirname, "../../model/data/labels.json");
  }

  /**
   * 음식 이미지를 CNN 모델로 분류
   * @param {string} imagePath - 업로드된 이미지 파일 경로
   * @returns {Promise<{class_name: string, confidence: number, top_5: Array}>}
   */
  async predict(imagePath) {
    return new Promise((resolve, reject) => {
      const args = [
        this.scriptPath,
        "--image",
        imagePath,
        "--model",
        this.modelPath,
        "--labels",
        this.labelsPath,
      ];

      const python = spawn(this.pythonPath, args, {
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      });

      let stdout = "";
      let stderr = "";

      python.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      python.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      python.on("close", (code) => {
        if (code !== 0) {
          console.error("CNN 추론 오류:", stderr);
          reject(new Error(`CNN 모델 추론 실패 (exit code: ${code})`));
          return;
        }

        try {
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (e) {
          reject(new Error("CNN 결과 파싱 실패: " + stdout));
        }
      });

      python.on("error", (error) => {
        reject(new Error(`Python 실행 실패: ${error.message}`));
      });
    });
  }

  /**
   * CNN 결과와 권장 식단 Label을 비교하여 일치 여부 판단
   * @param {string} scouterResult - CNN이 판독한 음식명
   * @param {string} recommendedMeal - AI가 권장한 식단 (JSON 문자열)
   * @param {number} confidence - CNN confidence score
   * @returns {{is_verified: boolean, match_detail: string}}
   */
  verifyMeal(scouterResult, recommendedMeal, confidence) {
    // confidence가 너무 낮으면 인식 실패로 처리
    const CONFIDENCE_THRESHOLD = 0.6;

    if (confidence < CONFIDENCE_THRESHOLD) {
      return {
        is_verified: false,
        match_detail: `인식 신뢰도가 낮습니다 (${(confidence * 100).toFixed(1)}%). 다시 촬영해주세요.`,
      };
    }

    try {
      const mealData = JSON.parse(recommendedMeal);
      // 권장 식단의 Label 목록과 CNN 결과 비교
      const recommendedLabels = mealData.items
        ? mealData.items.map((item) => item.label.toLowerCase())
        : [];

      const detected = scouterResult.toLowerCase();
      const isMatch = recommendedLabels.some(
        (label) => label.includes(detected) || detected.includes(label)
      );

      return {
        is_verified: isMatch,
        match_detail: isMatch
          ? `✅ '${scouterResult}'이(가) 권장 식단과 일치합니다.`
          : `❌ '${scouterResult}'은(는) 권장 식단에 포함되지 않습니다.`,
      };
    } catch (e) {
      return {
        is_verified: false,
        match_detail: "권장 식단 데이터 파싱에 실패했습니다.",
      };
    }
  }
}

module.exports = new FoodScouterService();
