import Link from "next/link";

type Props = {
  heading: string;
  error: string;
  startHref: string;
  profileHref: string;
};

export default function SelectionResultErrorState({
  heading,
  error,
  startHref,
  profileHref,
}: Props) {
  return (
    <section className="pb-12">
      <article className="rounded-[24px] border border-[#ffb39e]/55 bg-[linear-gradient(180deg,#fff8f4_0%,#fff2ed_100%)] px-5 py-5">
        <div className="text-[12px] font-semibold tracking-[0.04em] text-[#b6543f]">结果读取失败</div>
        <h1 className="mt-2 text-[26px] leading-[1.18] font-semibold tracking-[-0.02em] text-[#452016]">{heading}</h1>
        <p className="mt-3 text-[14px] leading-[1.55] text-[#6c3428]">已阻止页面崩溃，并展示后端返回的真实错误。</p>
        <p className="mt-3 rounded-2xl border border-[#f6c6bc] bg-white/82 px-3 py-2 text-[13px] leading-[1.55] text-[#7a2d21]">
          真实错误：{error || "unknown"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link
            href={startHref}
            className="inline-flex h-10 items-center justify-center rounded-full bg-black px-4 text-[14px] font-semibold text-white"
          >
            重新开始
          </Link>
          <Link
            href={profileHref}
            className="inline-flex h-10 items-center justify-center rounded-full border border-black/15 px-4 text-[14px] font-semibold text-black/78"
          >
            返回个人情况
          </Link>
        </div>
      </article>
    </section>
  );
}
