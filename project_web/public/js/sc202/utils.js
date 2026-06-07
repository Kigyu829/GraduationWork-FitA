'use strict';

/* ============================================================
   sc202/utils.js — 신체정보 입력 1 공용 유틸
   ============================================================ */

/**
 * 생년월일 유효성 검사
 * @param {string|number} year
 * @param {string|number} month
 * @param {string|number} day
 * @returns {boolean}
 */
function isValidBirth(year, month, day) {
  if (!year) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
}

/**
 * 생년월일 문자열 조합 (YYYY-MM-DD)
 * @param {string|number} year
 * @param {string|number} month
 * @param {string|number} day
 * @returns {string}
 */
function formatBirth(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
