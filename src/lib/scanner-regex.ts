/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Regex pattern for valid sticker codes.
 * Matches: 2-3 uppercase letters, space, 1-2 digit number.
 * Examples: "ESP 5", "ARG 12", "FWC 00"
 */
export const CODE_PATTERN = /^([A-Z]{2,3}) (\d{1,2})$/;

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
 * Parses a raw OCR text string and returns the matched components if valid, or null.
 */
export function parseOcrCode(raw: string): { sectionCode: string; number: string } | null {
  const trimmed = raw.trim().toUpperCase();
  const match = trimmed.match(CODE_PATTERN);
  if (!match) return null;

  const sectionCode = match[1];
  const number = match[2];

  if (!VALID_SECTIONS.has(sectionCode)) return null;
  if (!isValidNumber(sectionCode, number)) return null;

  return { sectionCode, number };
}
