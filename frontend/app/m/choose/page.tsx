import Link from "next/link";
import Image from "next/image";

const CATS = [
  { key: "shampoo", zh: "洗发水", note: "已开放", href: "/m/shampoo/start", open: true, image: "/m/categories/shampoo.png" },
  { key: "bodywash", zh: "沐浴露", note: "已开放", href: "/m/bodywash/start", open: true, image: "/m/categories/bodywash.png" },
  { key: "conditioner", zh: "护发素", note: "已开放", href: "/m/conditioner/start", open: true, image: "/m/categories/conditioner.png" },
  { key: "lotion", zh: "润肤霜", note: "已开放", href: "/m/lotion/start", open: true, image: "/m/categories/lotion.png" },
  { key: "cleanser", zh: "洗面奶", note: "已开放", href: "/m/cleanser/start", open: true, image: "/m/categories/cleanser.png" },
] as const;

export default function MobileChoose() {
  return (
    <div>
      <div className="text-[13px] font-medium text-black/45">选择品类</div>
      <div className="mt-2 text-[28px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/90">
        你想先解决哪一件
      </div>
      <p className="mt-2 text-[15px] leading-[1.52] text-black/58">
        横向滑动，进入对应决策路径。每个品类只会给一个最终答案。
      </p>

      <div className="mt-6 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-2.5 pr-2">
        {CATS.map((c) => (
          c.open ? (
            <Link
              key={c.key}
              href={c.href}
              className="flex aspect-square w-[96px] shrink-0 flex-col rounded-[22px] border border-[#d9dbe3] bg-[#ececf1] px-2 pt-2 pb-2 active:brightness-[0.98]"
            >
              <div className="flex min-h-0 flex-1 items-center justify-center">
                <Image src={c.image} alt={c.zh} width={74} height={58} className="h-[58px] w-[74px] object-contain" />
              </div>
              <div className="mt-1 text-center text-[13px] leading-[1.15] font-medium tracking-[-0.01em] text-black/88">{c.zh}</div>
            </Link>
          ) : (
            <div
              key={c.key}
              className="flex aspect-square w-[96px] shrink-0 flex-col rounded-[22px] border border-[#d9dbe3] bg-[#ececf1] px-2 pt-2 pb-2"
            >
              <div className="flex min-h-0 flex-1 items-center justify-center">
                <Image src={c.image} alt={c.zh} width={74} height={58} className="h-[58px] w-[74px] object-contain opacity-58" />
              </div>
              <div className="mt-1 text-center text-[13px] leading-[1.15] font-medium tracking-[-0.01em] text-black/58">{c.zh}</div>
            </div>
          )
        ))}
        </div>
      </div>
    </div>
  );
}
