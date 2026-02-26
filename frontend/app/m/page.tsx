import Link from "next/link";

export default function MobileHome() {
  return (
    <div className="pb-10">
      <h1
        className="text-[34px] leading-[1.08] font-semibold tracking-[-0.02em] text-black/90"
      >
        予选
      </h1>
      <div className="mt-2 text-[17px] leading-[1.35] font-semibold text-black/70">
        省下挑花眼的时间，只留最对位的一件。
      </div>

      <p className="mt-4 text-[16px] leading-[1.55] text-black/60">
        以 Apple 式的克制美学，把洗护选择做成低密度、可浏览、可对比的体验。
      </p>

      <div className="mt-8">
        <Link
          href="/m/choose"
          className="inline-flex h-11 items-center justify-center rounded-full px-5 text-[15px] font-semibold tracking-[-0.01em] text-white bg-black/90 active:bg-black"
        >
          开始选择
        </Link>
      </div>
    </div>
  );
}
