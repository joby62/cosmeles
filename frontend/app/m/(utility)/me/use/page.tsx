import Image from "next/image";
import MobileFrictionSignals from "@/components/mobile/MobileFrictionSignals";
import MobilePageAnalytics from "@/components/mobile/MobilePageAnalytics";
import MobileTrackedLink from "@/components/mobile/MobileTrackedLink";
import MeDecisionResumeCard from "@/features/mobile-utility/MeDecisionResumeCard";
import MobileUtilityReturnActionLink from "@/features/mobile-utility/MobileUtilityReturnActionLink";
import {
  applyMobileUtilityRouteState,
  parseMobileUtilityRouteState,
  resolveMobileUtilitySource,
} from "@/features/mobile-utility/routeState";

type UseCategory = {
  key: "shampoo" | "bodywash" | "conditioner" | "lotion" | "cleanser";
  label: string;
  image: string;
  tip: string;
};

type SearchParamsValue = string | string[] | undefined;
type UseSearchParams = Record<string, SearchParamsValue>;

const USE_CATEGORIES: UseCategory[] = [
  { key: "shampoo", label: "洗发水", image: "/m/categories/shampoo.png", tip: "头皮与发丝状态会影响继续使用判断" },
  { key: "bodywash", label: "沐浴露", image: "/m/categories/bodywash.png", tip: "补齐后可减少成分冲突与肤感误判" },
  { key: "conditioner", label: "护发素", image: "/m/categories/conditioner.png", tip: "便于判断顺滑感与修护是否匹配" },
  { key: "lotion", label: "润肤霜", image: "/m/categories/lotion.png", tip: "系统会结合季节与肤况给替换建议" },
  { key: "cleanser", label: "洗面奶", image: "/m/categories/cleanser.png", tip: "对比时可直接识别清洁负担是否过高" },
];

function firstSearchParam(value: SearchParamsValue): string {
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

function normalizeRequestedCategory(raw: string): UseCategory["key"] | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  return USE_CATEGORIES.find((item) => item.key === value)?.key || null;
}

export default async function MobileMeUsePage({
  searchParams,
}: {
  searchParams?: Promise<UseSearchParams> | UseSearchParams;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const routeState = parseMobileUtilityRouteState(resolvedSearchParams);
  const requestedCategory = normalizeRequestedCategory(firstSearchParam(resolvedSearchParams.category));
  const source = routeState.source || "";
  const analyticsSource = resolveMobileUtilitySource(routeState, "m_me_use");
  const orderedCategories = requestedCategory
    ? [
        ...USE_CATEGORIES.filter((item) => item.key === requestedCategory),
        ...USE_CATEGORIES.filter((item) => item.key !== requestedCategory),
      ]
    : USE_CATEGORIES;
  const requestedCategoryLabel = requestedCategory
    ? USE_CATEGORIES.find((item) => item.key === requestedCategory)?.label || requestedCategory
    : "";

  return (
    <section className="space-y-4 pb-8">
      <MobilePageAnalytics page="my_use" route="/m/me/use" source={analyticsSource} category={requestedCategory} />
      <MobileFrictionSignals page="my_use" route="/m/me/use" source={analyticsSource} category={requestedCategory} />
      <MobileUtilityReturnActionLink
        routeState={routeState}
        className="m-pressable inline-flex h-9 items-center rounded-full border border-black/12 bg-white/82 px-4 text-[12px] font-semibold text-black/72 active:bg-black/[0.03] dark:border-white/14 dark:bg-white/[0.05] dark:text-white/78"
      />
      <header className="overflow-hidden rounded-[30px] border border-black/10 bg-white/88 p-5 shadow-[0_10px_28px_rgba(20,34,58,0.08)] dark:border-white/15 dark:bg-[#0f1724]/84">
        <div className="inline-flex rounded-full border border-[#0071e3]/24 bg-[#0071e3]/8 px-3 py-1 text-[11px] font-semibold tracking-[0.01em] text-[#0071e3]">
          在用管理
        </div>
        <h1 className="mt-3 text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] text-[color:var(--m-text)]">在用清单</h1>
        <p className="mt-2 text-[14px] leading-6 text-black/62 dark:text-white/66">
          逐项上传你正在用的产品。后续横向对比会自动带入，可离开后继续，不会丢进度。
        </p>
        {requestedCategory ? (
          <div className="mt-4 rounded-[22px] border border-[#cfe2ff] bg-[linear-gradient(180deg,#f7faff_0%,#eef5ff_100%)] px-4 py-3 text-[#2450a3] shadow-[0_10px_24px_rgba(36,80,163,0.08)]">
            <div className="text-[11px] font-semibold tracking-[0.04em] text-[#3b67b6]">
              {source === "wiki_product_detail" ? "来自产品百科" : "已为你定位品类"}
            </div>
            <div className="mt-1 text-[15px] font-semibold leading-[1.45]">
              已为你定位到“{requestedCategoryLabel}”，直接上传这一类即可开始分析。
            </div>
          </div>
        ) : null}
      </header>
      <MeDecisionResumeCard routeState={routeState} />

      <div className="grid gap-3 min-[560px]:grid-cols-2">
        {orderedCategories.map((item) => {
          const isRequested = item.key === requestedCategory;
          const hrefParams = new URLSearchParams({
            category: item.key,
          });
          applyMobileUtilityRouteState(hrefParams, routeState);
          const href = `/m/compare?${hrefParams.toString()}`;
          return (
          <article
            key={item.key}
            className={`rounded-[26px] border bg-white/90 p-4 shadow-[0_6px_20px_rgba(20,34,58,0.06)] dark:bg-[#101a2a]/84 ${
              isRequested
                ? "border-[#7fb0ff] shadow-[0_14px_32px_rgba(36,80,163,0.14)] ring-1 ring-[#d8e7ff]"
                : "border-black/10 dark:border-white/15"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-[color:var(--m-choose-image-bg)] ring-1 ring-black/6 dark:ring-white/10">
                <Image src={item.image} alt={item.label} fill sizes="48px" unoptimized className="object-contain p-1.5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[17px] leading-[1.3] font-semibold text-[color:var(--m-text)]">{item.label}</h2>
                  {isRequested ? (
                    <span className="inline-flex rounded-full border border-[#cfe2ff] bg-[#eef5ff] px-2.5 py-1 text-[10px] font-semibold text-[#2450a3]">
                      优先上传
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[12px] leading-5 text-black/56 dark:text-white/58">{item.tip}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-end">
              <MobileTrackedLink
                href={href}
                eventName="my_use_category_card_click"
                data-analytics-id={`my-use:category:${item.key}`}
                data-analytics-dead-click-watch="true"
                eventProps={{
                  page: "my_use",
                  route: "/m/me/use",
                  source: analyticsSource,
                  category: item.key,
                  is_prefilled: isRequested,
                  target_path: "/m/compare",
                }}
                className={`m-pressable inline-flex h-9 items-center justify-center rounded-full px-4 text-[13px] font-semibold text-white active:bg-[#0068d1] ${
                  isRequested
                    ? "bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] shadow-[0_12px_24px_rgba(0,113,227,0.3)]"
                    : "bg-[#0071e3] shadow-[0_10px_20px_rgba(0,113,227,0.28)]"
                }`}
              >
                {isRequested ? `上传${item.label}` : "上传并识别"}
              </MobileTrackedLink>
            </div>
          </article>
          );
        })}
      </div>
    </section>
  );
}
