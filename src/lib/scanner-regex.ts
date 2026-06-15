/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OCR post-processing pipeline:
 *   1. Normalize (uppercase + trim)
 *   2. Sanitize — strip any char that isn't A-Z, 0-9, or whitespace
 *   3. Autocorrect — insert space between section code and number if missing (e.g. "ESP1" → "ESP 1")
 *   4. Strict regex — full string must match /^(00|[A-Z]{2,3}\s\d{1,2})$/
 *   5. Validate — section exists in album + number is in valid range
 */

/**
 * All valid section identifiers in the album.
 */
export const VALID_SECTIONS: ReadonlySet<string> = new Set([
  'MEX','RSA','KOR','CZE','CAN','BIH','QAT','SUI','BRA','MAR',
  'HAI','SCO','USA','PAR','AUS','TUR','GER','CUW','CIV','ECU',
  'NED','JPN','SWE','TUN','BEL','EGY','IRN','NZL','ESP','CPV',
  'KSA','URU','FRA','SEN','IRQ','NOR','ARG','ALG','AUT','JOR',
  'PORT','COD','UZB','COL','ENG','CRO','GHA','PAN','FWC','CC',
]);

/**
 * Valid number ranges per section type.
 * - Team sections: 1-20
 * - FWC special: 00, 1-19
 * - CC section: 1-14
 */
export function isValidNumber(sectionCode: string, num: string): boolean {
  if (sectionCode === 'FWC') {
    return num === '00' || (num !== '' && !isNaN(Number(num)) && Number(num) >= 1 && Number(num) <= 19);
  }
  if (sectionCode === 'CC') {
    return num !== '' && !isNaN(Number(num)) && Number(num) >= 1 && Number(num) <= 14;
  }
  // Team sections (all other valid codes)
  return num !== '' && !isNaN(Number(num)) && Number(num) >= 1 && Number(num) <= 20;
}

/**
 * Strict regex for final validation.
 * Anchored to full string — matches either the special "00" code
 * or a standard section+number pattern like "ARG 10".
 */
const STRICT_CODE_PATTERN = /^(00|[A-Z]{2,3}\s\d{1,2})$/;

/**
 * Parses a raw OCR text string through the full post-processing pipeline.
 * Returns the matched components if valid, or null.
 */
export function parseOcrCode(raw: string): { sectionCode: string; number: string } | null {
  // Step 1: Normalize
  let text = raw.trim().toUpperCase();

  // Step 2: Sanitize — strip anything that isn't A-Z, 0-9, or whitespace
  text = text.replace(/[^A-Z0-9\s]/g, '');

  // Step 3: Autocorrect — insert missing space between section letters and number
  // e.g. "ESP1" → "ESP 1", "ARG10" → "ARG 10"
  text = text.replace(/([A-Z]{2,3})(\d{1,2})/g, '$1 $2');

  // Step 4: Strict full-string validation
  const trimmed = text.trim();
  const match = trimmed.match(STRICT_CODE_PATTERN);
  if (!match) return null;

  const code = match[1]; // "00" or e.g. "ARG 10"

  // "00" is the special FWC code
  if (code === '00') {
    if (!VALID_SECTIONS.has('FWC') || !isValidNumber('FWC', '00')) return null;
    return { sectionCode: 'FWC', number: '00' };
  }

  // Standard section + number
  const [sectionCode, number] = code.split(' ');
  if (!VALID_SECTIONS.has(sectionCode)) return null;
  if (!isValidNumber(sectionCode, number)) return null;

  return { sectionCode, number };
}
