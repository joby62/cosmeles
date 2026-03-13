import { listBodyWashProfileSteps } from "@/domain/mobile/decision/bodywash";
import { listCleanserProfileSteps } from "@/domain/mobile/decision/cleanser";
import { listConditionerProfileSteps } from "@/domain/mobile/decision/conditioner";
import { listLotionProfileSteps } from "@/domain/mobile/decision/lotion";
import { listShampooProfileSteps } from "@/domain/mobile/decision/shampoo";
import type { MobileSelectionCategory } from "@/lib/api";
import {
  bodyWashChoiceLabel,
  isReadyBodyWashResult,
  normalizeBodyWashSignals,
  toBodyWashSearchParams,
  type BodyWashSignals,
} from "@/lib/mobile/bodywashDecision";
import {
  BODYWASH_LAST_RESULT_QUERY_KEY,
  BODYWASH_PROFILE_DRAFT_KEY,
} from "@/lib/mobile/bodywashFlowStorage";
import {
  cleanserChoiceLabel,
  isCompleteCleanserSignals,
  normalizeCleanserSignals,
  toCleanserSearchParams,
  type CleanserSignals,
} from "@/lib/mobile/cleanserDecision";
import {
  CLEANSER_LAST_RESULT_QUERY_KEY,
  CLEANSER_PROFILE_DRAFT_KEY,
} from "@/lib/mobile/cleanserFlowStorage";
import {
  conditionerChoiceLabel,
  isCompleteConditionerSignals,
  normalizeConditionerSignals,
  toConditionerSearchParams,
  type ConditionerSignals,
} from "@/lib/mobile/conditionerDecision";
import {
  CONDITIONER_LAST_RESULT_QUERY_KEY,
  CONDITIONER_PROFILE_DRAFT_KEY,
} from "@/lib/mobile/conditionerFlowStorage";
import {
  isCompleteLotionSignals,
  lotionChoiceLabel,
  normalizeLotionSignals,
  toLotionSearchParams,
  type LotionSignals,
} from "@/lib/mobile/lotionDecision";
import {
  LOTION_LAST_RESULT_QUERY_KEY,
  LOTION_PROFILE_DRAFT_KEY,
} from "@/lib/mobile/lotionFlowStorage";
import {
  isReadyShampooResult,
  normalizeShampooSignals,
  shampooChoiceLabel,
  toSignalSearchParams,
  type ShampooSignals,
} from "@/lib/mobile/shampooDecision";
import {
  SHAMPOO_LAST_RESULT_QUERY_KEY,
  SHAMPOO_PROFILE_DRAFT_KEY,
} from "@/lib/mobile/shampooFlowStorage";

export type DecisionShellSearch = Record<string, string | string[] | undefined>;
export type DecisionShellSignals = Record<string, string | undefined>;

export type DecisionShellStep = {
  key: string;
  title: string;
  note: string;
  options: ReadonlyArray<{
    value: string;
    label: string;
    sub: string;
  }>;
};

export type DecisionShellConfig = {
  category: MobileSelectionCategory;
  titlePrefix: string;
  emptyImageLabel: string;
  resultErrorHeading: string;
  profileDraftStorageKey: string;
  lastResultQueryStorageKey: string;
  steps: readonly DecisionShellStep[];
  normalizeSignals: (raw: DecisionShellSearch) => DecisionShellSignals;
  isComplete: (signals: DecisionShellSignals) => boolean;
  toSearchParams: (signals: DecisionShellSignals) => URLSearchParams;
  getChoiceLabel: (key: string, value: string) => string;
  parseResultAnswers: (raw: DecisionShellSearch) => Record<string, string> | null;
};

const DECISION_SHELL_CONFIG: Record<MobileSelectionCategory, DecisionShellConfig> = {
  shampoo: {
    category: "shampoo",
    titlePrefix: "洗发挑选",
    emptyImageLabel: "Shampoo",
    resultErrorHeading: "洗发水预生成结果暂时不可用",
    profileDraftStorageKey: SHAMPOO_PROFILE_DRAFT_KEY,
    lastResultQueryStorageKey: SHAMPOO_LAST_RESULT_QUERY_KEY,
    steps: toDecisionShellSteps(listShampooProfileSteps()),
    normalizeSignals: (raw) => normalizeShampooSignals(raw) as DecisionShellSignals,
    isComplete: (signals) => isReadyShampooResult(signals as ShampooSignals),
    toSearchParams: (signals) => toSignalSearchParams(signals as ShampooSignals),
    getChoiceLabel: (key, value) =>
      shampooChoiceLabel(
        key as "q1" | "q2" | "q3",
        value as "A" | "B" | "C" | "D",
      ),
    parseResultAnswers: (raw) =>
      parseAnswerRecord(raw, [
        { key: "q1", validate: isIn("A", "B", "C") },
        { key: "q2", validate: isIn("A", "B", "C", "D") },
        { key: "q3", validate: isIn("A", "B", "C") },
      ]),
  },
  bodywash: {
    category: "bodywash",
    titlePrefix: "沐浴挑选",
    emptyImageLabel: "Body Wash",
    resultErrorHeading: "沐浴露预生成结果暂时不可用",
    profileDraftStorageKey: BODYWASH_PROFILE_DRAFT_KEY,
    lastResultQueryStorageKey: BODYWASH_LAST_RESULT_QUERY_KEY,
    steps: toDecisionShellSteps(listBodyWashProfileSteps()),
    normalizeSignals: (raw) => normalizeBodyWashSignals(raw) as DecisionShellSignals,
    isComplete: (signals) => isReadyBodyWashResult(signals as BodyWashSignals),
    toSearchParams: (signals) => toBodyWashSearchParams(signals as BodyWashSignals),
    getChoiceLabel: (key, value) =>
      bodyWashChoiceLabel(
        key as "q1" | "q2" | "q3" | "q4" | "q5",
        value as "A" | "B" | "C" | "D",
      ),
    parseResultAnswers: (raw) =>
      parseAnswerRecord(raw, [
        { key: "q1", validate: isIn("A", "B", "C", "D") },
        { key: "q2", validate: isIn("A", "B") },
        { key: "q3", validate: isIn("A", "B", "C", "D") },
        { key: "q4", validate: isIn("A", "B") },
        { key: "q5", validate: isIn("A", "B") },
      ]),
  },
  conditioner: {
    category: "conditioner",
    titlePrefix: "护发素决策",
    emptyImageLabel: "Conditioner",
    resultErrorHeading: "护发素预生成结果暂时不可用",
    profileDraftStorageKey: CONDITIONER_PROFILE_DRAFT_KEY,
    lastResultQueryStorageKey: CONDITIONER_LAST_RESULT_QUERY_KEY,
    steps: toDecisionShellSteps(listConditionerProfileSteps()),
    normalizeSignals: (raw) => normalizeConditionerSignals(raw) as DecisionShellSignals,
    isComplete: (signals) => isCompleteConditionerSignals(signals as ConditionerSignals),
    toSearchParams: (signals) => toConditionerSearchParams(signals as ConditionerSignals),
    getChoiceLabel: (key, value) =>
      conditionerChoiceLabel(
        key as "c_q1" | "c_q2" | "c_q3",
        value as "A" | "B" | "C",
      ),
    parseResultAnswers: (raw) =>
      parseAnswerRecord(raw, [
        { key: "c_q1", validate: isNonEmpty },
        { key: "c_q2", validate: isNonEmpty },
        { key: "c_q3", validate: isNonEmpty },
      ]),
  },
  lotion: {
    category: "lotion",
    titlePrefix: "润肤霜决策",
    emptyImageLabel: "Lotion",
    resultErrorHeading: "润肤霜预生成结果暂时不可用",
    profileDraftStorageKey: LOTION_PROFILE_DRAFT_KEY,
    lastResultQueryStorageKey: LOTION_LAST_RESULT_QUERY_KEY,
    steps: toDecisionShellSteps(listLotionProfileSteps()),
    normalizeSignals: (raw) => normalizeLotionSignals(raw) as DecisionShellSignals,
    isComplete: (signals) => isCompleteLotionSignals(signals as LotionSignals),
    toSearchParams: (signals) => toLotionSearchParams(signals as LotionSignals),
    getChoiceLabel: (key, value) =>
      lotionChoiceLabel(
        key as "q1" | "q2" | "q3" | "q4" | "q5",
        value as "A" | "B" | "C" | "D" | "E",
      ),
    parseResultAnswers: (raw) =>
      parseAnswerRecord(raw, [
        { key: "q1", validate: isIn("A", "B", "C", "D") },
        { key: "q2", validate: isIn("A", "B") },
        { key: "q3", validate: isIn("A", "B", "C", "D", "E") },
        { key: "q4", validate: isIn("A", "B", "C") },
        { key: "q5", validate: isIn("A", "B", "C") },
      ]),
  },
  cleanser: {
    category: "cleanser",
    titlePrefix: "洗面奶决策",
    emptyImageLabel: "Cleanser",
    resultErrorHeading: "洗面奶预生成结果暂时不可用",
    profileDraftStorageKey: CLEANSER_PROFILE_DRAFT_KEY,
    lastResultQueryStorageKey: CLEANSER_LAST_RESULT_QUERY_KEY,
    steps: toDecisionShellSteps(listCleanserProfileSteps()),
    normalizeSignals: (raw) => normalizeCleanserSignals(raw) as DecisionShellSignals,
    isComplete: (signals) => isCompleteCleanserSignals(signals as CleanserSignals),
    toSearchParams: (signals) => toCleanserSearchParams(signals as CleanserSignals),
    getChoiceLabel: (key, value) =>
      cleanserChoiceLabel(
        key as "q1" | "q2" | "q3" | "q4" | "q5",
        value as "A" | "B" | "C" | "D" | "E",
      ),
    parseResultAnswers: (raw) =>
      parseAnswerRecord(raw, [
        { key: "q1", validate: isIn("A", "B", "C", "D") },
        { key: "q2", validate: isIn("A", "B", "C") },
        { key: "q3", validate: isIn("A", "B", "C") },
        { key: "q4", validate: isIn("A", "B", "C", "D", "E") },
        { key: "q5", validate: isIn("A", "B", "C", "D") },
      ]),
  },
};

export function getDecisionShellConfig(category: MobileSelectionCategory): DecisionShellConfig {
  return DECISION_SHELL_CONFIG[category];
}

function toDecisionShellSteps(
  steps: ReadonlyArray<{
    key: string;
    title: string;
    note: string;
    options: ReadonlyArray<{ value: string; label: string; sub: string }>;
  }>,
): readonly DecisionShellStep[] {
  return steps.map((step) => ({
    key: step.key,
    title: step.title,
    note: step.note,
    options: step.options.map((option) => ({
      value: String(option.value),
      label: option.label,
      sub: option.sub,
    })),
  }));
}

function parseAnswerRecord(
  raw: DecisionShellSearch,
  rules: ReadonlyArray<{ key: string; validate: (value: string | null) => boolean }>,
): Record<string, string> | null {
  const output: Record<string, string> = {};
  for (const rule of rules) {
    const value = readSearchValue(raw, rule.key);
    if (!rule.validate(value)) return null;
    output[rule.key] = value as string;
  }
  return output;
}

function readSearchValue(raw: DecisionShellSearch, key: string): string | null {
  const value = raw[key];
  const picked = Array.isArray(value) ? value[0] : value;
  if (typeof picked !== "string") return null;
  const normalized = picked.trim();
  return normalized || null;
}

function isIn(...values: string[]): (value: string | null) => boolean {
  const set = new Set(values);
  return (value) => Boolean(value && set.has(value));
}

function isNonEmpty(value: string | null): boolean {
  return Boolean(value);
}
