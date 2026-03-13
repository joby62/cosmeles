import type { SiteLocale } from "@/lib/sitePreferences";
import * as en from "@/lib/collections.en";
import * as zh from "@/lib/collections.zh";
import type { ConcernCollectionMeta } from "@/lib/collections.en";

export type { ConcernCollectionMeta, ConcernCollectionKey } from "@/lib/collections.en";
export const CONCERN_COLLECTIONS = en.CONCERN_COLLECTIONS;
export const CONCERN_COLLECTION_LIST = en.CONCERN_COLLECTION_LIST;
export const isConcernCollectionKey = en.isConcernCollectionKey;
export const normalizeConcernCollectionKey = en.normalizeConcernCollectionKey;
export const collectionHref = en.collectionHref;

function getCollectionContent(locale: SiteLocale = "en") {
  return locale === "zh" ? zh : en;
}

export function getConcernCollection(value: string | null | undefined, locale: SiteLocale = "en"): ConcernCollectionMeta | null {
  const key = normalizeConcernCollectionKey(value);
  return key ? getCollectionContent(locale).CONCERN_COLLECTIONS[key] : null;
}

export function getConcernCollectionList(locale: SiteLocale = "en") {
  return getCollectionContent(locale).CONCERN_COLLECTION_LIST;
}
