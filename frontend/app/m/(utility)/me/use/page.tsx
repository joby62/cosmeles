import Image from "next/image";
import MobileEventBeacon from "@/components/mobile/MobileEventBeacon";
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
import {
  buildMobileCompareKeepCurrentLandingTargetPath,
  parseMobileCompareKeepCurrentClosure,
} from "@/lib/mobile/compareClosure";

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
  const keepCurrentClosureState = parseMobileCompareKeepCurrentClosure(resolvedSearchParams);
  const keepCurrentClosure = Boolean(keepCurrentClosureState);
  const keepCurrentDecision = keepCurrentClosureState?.decision || null;
  const keepCurrentSource = keepCurrentClosureState?.productSource || null;
  const keepCurrentProductLabel = keepCurrentClosureState?.productLabel || "当前这款";
  const orderedCategories = requestedCategory
    ? [
        ...USE_CATEGORIES.filter((item) => item.key === requestedCategory),
        ...USE_CATEGORIES.filter((item) => item.key !== requestedCategory),
      ]
    : USE_CATEGORIES;
  const requestedCategoryLabel = requestedCategory
    ? USE_CATEGORIES.find((item) => item.key === requestedCategory)?.label || requestedCategory
    : "";
  const keepCurrentCompleted = keepCurrentClosureState?.isCompleted || false;
  const keepCurrentLandingTargetPath =
    buildMobileCompareKeepCurrentLandingTargetPath(requestedCategory);
  const keepCurrentClosureTitle = keepCurrentCompleted
    ? keepCurrentDecision === "hybrid"
      ? "已先保留现在这款"
      : "已继续用现在这款"
    : "还差一步：补记当前这款";
  const keepCurrentClosureBody = keepCurrentCompleted
    ? keepCurrentSource === "history_product"
      ? keepCurrentDecision === "hybrid"
        ? `${keepCurrentProductLabel} 已直接沿用你现有的在用记录，这次先按当前方案走，推荐款先留作后续备选。`
        : `${keepCurrentProductLabel} 已直接沿用你现有的在用记录，这次继续用当前方案，不需要再补记。`
      : keepCurrentDecision === "hybrid"
        ? `${keepCurrentProductLabel} 已写入你的在用清单，这次先保留当前方案；推荐款可以后续再试。`
        : `${keepCurrentProductLabel} 已写入你的在用清单，这次继续用当前方案，后面可再观察是否需要换。`
    : `${keepCurrentProductLabel} 目前还未写入在用清单。先在下方完成上传，才能把“继续用 / 先保留”的结论真正落档。`;
  const pageIntro =
    keepCurrentClosure && keepCurrentDecision
      ? keepCurrentCompleted
        ? keepCurrentDecision === "hybrid"
          ? "这次 compare 已确认先保留当前方案，并已回写到在用清单。"
          : "这次 compare 已确认继续用当前方案，并已回写到在用清单。"
        : "这次 compare 已先判为保留当前方案，现在只差把这款产品补记进在用清单。"
      : "逐项上传你正在用的产品。后续横向对比会自动带入，可离开后继续，不会丢进度。";
  const shouldTrackKeepCurrentLand =
    Boolean(
      keepCurrentClosure &&
        keepCurrentDecision &&
        keepCurrentCompleted &&
        requestedCategory &&
        routeState.compareId,
    );

  return (
    <section className="space-y-4 pb-8">
      <MobilePageAnalytics page="my_use" route="/m/me/use" source={analyticsSource} category={requestedCategory} />
      <MobileFrictionSignals page="my_use" route="/m/me/use" source={analyticsSource} category={requestedCategory} />
      {shouldTrackKeepCurrentLand ? (
        <MobileEventBeacon
          name="compare_result_keep_current_land"
          props={{
            page: "my_use",
            route: "/m/me/use",
            source: analyticsSource,
            category: requestedCategory,
            compare_id: routeState.compareId,
            target_path: keepCurrentLandingTargetPath,
          }}
        />
      ) : null}
      <MobileUtilityReturnActionLink
        routeState={routeState}
        className="m-pressable inline-flex h-9 items-center rounded-full border border-black/12 bg-white/82 px-4 text-[12px] font-semibold text-black/72 active:bg-black/[0.03] dark:border-white/14 dark:bg-white/[0.05] dark:text-white/78"
      />
      {keepCurrentClosure && keepCurrentDecision ? (
        <article
          className={`rounded-[26px] border px-4 py-4 shadow-[0_10px_24px_rgba(36,80,163,0.1)] ${
            keepCurrentCompleted
              ? "border-[#cfe2ff] bg-[linear-gradient(180deg,#f7faff_0%,#edf4ff_100%)] text-[#214d99]"
              : "border-[#f2d7a8] bg-[linear-gradient(180deg,#fff9ec_0%,#fff4de_100%)] text-[#8c6015]"
          }`}
        >
          <div className="inline-flex rounded-full border border-[#b8d3ff] bg-white/78 px-3 py-1 text-[11px] font-semibold tracking-[0.04em] text-[#3565b8]">
            {keepCurrentCompleted ? "Compare 裁决已完成" : "Compare 裁决待落档"}
          </div>
          <h2 className={`mt-3 text-[22px] leading-[1.28] font-semibold tracking-[-0.02em] ${keepCurrentCompleted ? "text-[#183b77]" : "text-[#7a5310]"}`}>
            {keepCurrentClosureTitle}
          </h2>
          <p className={`mt-2 text-[13px] leading-[1.65] ${keepCurrentCompleted ? "text-[#3560aa]" : "text-[#91641b]"}`}>{keepCurrentClosureBody}</p>
          {requestedCategoryLabel ? (
            <div
              className={`mt-3 rounded-[18px] border bg-white/72 px-3 py-2 text-[12px] leading-[1.55] ${
                keepCurrentCompleted
                  ? "border-[#d5e4ff] text-[#3f68ab]"
                  : "border-[#efd9b3] text-[#8b631f]"
              }`}
            >
              {keepCurrentCompleted
                ? `已帮你把这次决定落到“${requestedCategoryLabel}”在用入口，后续这类 compare 会直接复用当前产品记录。`
                : `已为你定位“${requestedCategoryLabel}”入口，上传后就能把本次 keep/hybrid 决策正式写入在用清单。`}
            </div>
          ) : null}
        </article>
      ) : null}
      <header className="overflow-hidden rounded-[30px] border border-black/10 bg-white/88 p-5 shadow-[0_10px_28px_rgba(20,34,58,0.08)] dark:border-white/15 dark:bg-[#0f1724]/84">
        <div className="inline-flex rounded-full border border-[#0071e3]/24 bg-[#0071e3]/8 px-3 py-1 text-[11px] font-semibold tracking-[0.01em] text-[#0071e3]">
          在用管理
        </div>
        <h1 className="mt-3 text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] text-[color:var(--m-text)]">在用清单</h1>
        <p className="mt-2 text-[14px] leading-6 text-black/62 dark:text-white/66">
          {pageIntro}
        </p>
        {requestedCategory ? (
          <div className="mt-4 rounded-[22px] border border-[#cfe2ff] bg-[linear-gradient(180deg,#f7faff_0%,#eef5ff_100%)] px-4 py-3 text-[#2450a3] shadow-[0_10px_24px_rgba(36,80,163,0.08)]">
            <div className="text-[11px] font-semibold tracking-[0.04em] text-[#3b67b6]">
              {keepCurrentClosure && keepCurrentDecision
                ? keepCurrentCompleted
                  ? "compare 裁决已落档"
                  : "来自 compare 裁决"
                : source === "wiki_product_detail"
                  ? "来自产品百科"
                  : "已为你定位品类"}
            </div>
            <div className="mt-1 text-[15px] font-semibold leading-[1.45]">
              {keepCurrentClosure && keepCurrentDecision
                ? keepCurrentCompleted
                  ? `已为你定位到“${requestedCategoryLabel}”，这次${keepCurrentDecision === "hybrid" ? "先保留当前" : "继续用当前"}已经正式写回在用清单。`
                  : `已为你定位到“${requestedCategoryLabel}”，从这里补记当前产品，就能把本次 keep/hybrid 裁决正式落档。`
                : `已为你定位到“${requestedCategoryLabel}”，直接上传这一类即可开始分析。`}
            </div>
          </div>
        ) : null}
      </header>
      <MeDecisionResumeCard routeState={routeState} />

      <div className="grid gap-3 min-[560px]:grid-cols-2">
        {orderedCategories.map((item) => {
          const isRequested = item.key === requestedCategory;
          const isKeepCurrentPendingCard = keepCurrentClosure && keepCurrentDecision && !keepCurrentCompleted && isRequested;
          const isKeepCurrentCompletedCard = keepCurrentClosure && keepCurrentDecision && keepCurrentCompleted && isRequested;
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
                      {isKeepCurrentPendingCard ? "待补记" : isKeepCurrentCompletedCard ? "已落档" : "优先上传"}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[12px] leading-5 text-black/56 dark:text-white/58">{item.tip}</p>
                {isKeepCurrentPendingCard ? (
                  <p className="mt-2 text-[12px] leading-5 text-[#94651d]">
                    这一步只用于把当前这款记入在用清单，不改变上一步的 compare 裁决。
                  </p>
                ) : isKeepCurrentCompletedCard ? (
                  <p className="mt-2 text-[12px] leading-5 text-[#2e5ca8]">
                    这次{keepCurrentDecision === "hybrid" ? "先保留当前" : "继续用当前"}已经正式落档；后面想换一款当前产品再比，再从这里进入即可。
                  </p>
                ) : null}
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
                {isKeepCurrentPendingCard
                  ? "继续补记这款"
                  : isKeepCurrentCompletedCard
                    ? "管理这类在用"
                    : isRequested
                      ? `上传${item.label}`
                      : "上传并识别"}
              </MobileTrackedLink>
            </div>
          </article>
          );
        })}
      </div>
    </section>
  );
}
