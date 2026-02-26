import Link from "next/link";

type HomeTag = {
  key: "shampoo" | "bodywash" | "conditioner" | "lotion" | "cleanser";
  label: string;
  image: string;
  href?: string;
};

const TAGS: HomeTag[] = [
  { key: "shampoo", label: "洗发水", image: "/m/categories/shampoo.png", href: "/m/shampoo/start" },
  { key: "bodywash", label: "沐浴露", image: "/m/categories/bodywash.png" },
  { key: "conditioner", label: "护发素", image: "/m/categories/conditioner.png" },
  { key: "lotion", label: "润肤霜", image: "/m/categories/lotion.png" },
  { key: "cleanser", label: "洗面奶", image: "/m/categories/cleanser.png" },
];

export default function MobileHome() {
  return (
    <div className="pb-10">
      <h1 className="text-[44px] leading-[1.02] font-semibold tracking-[-0.03em] text-black/92">予选</h1>

      <section className="mt-5">
        <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-2.5">
            {TAGS.map((tag) =>
              tag.href ? (
                <Link
                  key={tag.key}
                  href={tag.href}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-black/80 bg-black px-3 text-[13px] text-white"
                >
                  <img src={tag.image} alt={tag.label} className="h-5 w-5 rounded-full object-cover" />
                  {tag.label}
                </Link>
              ) : (
                <span
                  key={tag.key}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-black/8 bg-white/70 px-3 text-[13px] text-black/40"
                >
                  <img src={tag.image} alt={tag.label} className="h-5 w-5 rounded-full object-cover opacity-60" />
                  {tag.label}
                </span>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="slogan-breathe text-[46px] leading-[1.04] font-semibold tracking-[-0.032em] text-black/92">
          浴室里的最终答案。
        </h2>
        <p className="mt-4 text-[21px] leading-[1.36] font-semibold tracking-[-0.012em] text-black/62">
          省下挑花眼的时间，只留最对位的一件。
        </p>
      </section>
    </div>
  );
}
