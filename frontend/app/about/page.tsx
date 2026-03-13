import FeatureShell from "@/components/site/FeatureShell";

export default function AboutPage() {
  return (
    <FeatureShell
      eyebrow="关于婕选"
      title="婕选想把个护独立站做成一个先讲清楚、再让人下决定的地方。"
      summary="我们不想用堆砌信息、制造焦虑或强推转化的方式卖东西。婕选更关心的是：产品是否适合、差异是否说清楚、成分是否可查、配送与退货是否提前可见。"
      highlights={["信息更轻，但判断更稳", "先讲适配，再谈卖点", "成分透明本身就是信任层"]}
      primaryCta={{ href: "/shop", label: "进入选购" }}
      secondaryCta={{ href: "/support/faq", label: "查看常见问题" }}
    />
  );
}
