/**
 * ISO 639-1 codes accepted for `lang` on analysis requests.
 * Keep in sync with the ScanFace / ScoreMax upstream API.
 */
export const SUPPORTED_ANALYSIS_LANG_CODES = ["en", "fr", "es"] as const;

export type SupportedAnalysisLangCode = (typeof SUPPORTED_ANALYSIS_LANG_CODES)[number];

const supportedSet = new Set<string>(SUPPORTED_ANALYSIS_LANG_CODES);

export function isSupportedAnalysisLangCode(code: string): boolean {
  return supportedSet.has(code);
}
