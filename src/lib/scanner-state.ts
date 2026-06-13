/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ScanResult } from '../types';
import { loadCollectionState } from '../data';
import { parseOcrCode } from './scanner-regex';

/**
 * Resolve a parsed scanner code into a full ScanResult with localStorage status.
 * Returns null if the code is invalid or the section/number is out of range.
 */
export function resolveCardStatus(code: string): ScanResult | null {
  const parsed = parseOcrCode(code);
  if (!parsed) return null;

  const { sectionCode, number } = parsed;
  const cardId = `${sectionCode}_${number}`;
  const collection = loadCollectionState();
  const count = collection[cardId] || 0;

  let status: ScanResult['status'];
  if (count === 0) {
    status = 'missing';
  } else if (count === 1) {
    status = 'pasted';
  } else {
    status = 'repeated';
  }

  return {
    raw: code,
    code: `${sectionCode} ${number}`,
    sectionCode,
    number,
    cardId,
    count,
    status,
  };
}
