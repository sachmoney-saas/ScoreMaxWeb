import { isSupportedAnalysisLangCode } from "@shared/supported-analysis-langs";
import { ApiError } from "./errors";

export function assertSupportedAnalysisLang(lang: string | undefined): void {
  if (lang === undefined) {
    return;
  }
  if (!isSupportedAnalysisLangCode(lang)) {
    throw new ApiError({
      code: "UNSUPPORTED_LANGUAGE",
      status: 400,
      message: "lang is not a supported ISO 639-1 code",
    });
  }
}
