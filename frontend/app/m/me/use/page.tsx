import Image from "next/image";
import Link from "next/link";

type UseCategory = {
  key: "shampoo" | "bodywash" | "conditioner" | "lotion" | "cleanser";
  label: string;
  image: string;
  tip: string;
};

const USE_CATEGORIES: UseCategory[] = [
  { key: "shampoo", label: "洗发水", image: "/m/categories/shampoo.png", tip: "头皮与发丝状态会影响继续使用判断" },
  { key: "bodywash", label: "沐浴露", image: "/m/categories/bodywash.png", tip: "补齐后可减少成分冲突与肤感误判" },
  { key: "conditioner", label: "护发素", image: "/m/categories/conditioner.png", tip: "便于判断顺滑感与修护是否匹配" },
  { key: "lotion", label: "润肤霜", image: "/m/categories/lotion.png", tip: "系统会结合季节与肤况给替换建议" },
  { key: "cleanser", label: "洗面奶", image: "/m/categories/cleanser.png", tip: "对比时可直接识别清洁负担是否过高" },
];

export default function MobileMeUsePage() {
  return (
    <section className="space-y-4 pb-8">
      <header className="overflow-hidden rounded-[30px] border border-black/10 bg-white/88 p-5 shadow-[0_10px_28px_rgba(20,34,58,0.08)] dark:border-white/15 dark:bg-[#0f1724]/84">
        <div className="inline-flex rounded-full border border-[#0071e3]/24 bg-[#0071e3]/8 px-3 py-1 text-[11px] font-semibold tracking-[0.01em] text-[#0071e3]">
          在用管理
        </div>
        <h1 className="mt-3 text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] text-[color:var(--m-text)]">在用清单</h1>
        <p className="mt-2 text-[14px] leading-6 text-black/62 dark:text-white/66">
          逐项上传你正在用的产品。后续横向对比会自动带入，可离开后继续，不会丢进度。
        </p>
      </header>

      <div className="grid gap-3 min-[560px]:grid-cols-2">
        {USE_CATEGORIES.map((item) => (
          <article
            key={item.key}
            className="rounded-[26px] border border-black/10 bg-white/90 p-4 shadow-[0_6px_20px_rgba(20,34,58,0.06)] dark:border-white/15 dark:bg-[#101a2a]/84"
          >
            <div className="flex items-start gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-[color:var(--m-choose-image-bg)] ring-1 ring-black/6 dark:ring-white/10">
                <Image src={item.image} alt={item.label} fill sizes="48px" unoptimized className="object-contain p-1.5" />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] leading-[1.3] font-semibold text-[color:var(--m-text)]">{item.label}</h2>
                <p className="mt-1 text-[12px] leading-5 text-black/56 dark:text-white/58">{item.tip}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-end">
              <Link
                href={`/m/compare?category=${item.key}`}
                className="m-pressable inline-flex h-9 items-center justify-center rounded-full bg-[#0071e3] px-4 text-[13px] font-semibold text-white shadow-[0_10px_20px_rgba(0,113,227,0.28)] active:bg-[#0068d1]"
              >
                上传并识别
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
