import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ANALYTICS_SECTIONS } from "@/lib/analyticsNav";
import {
  ADMIN_CONSOLE_DEFAULT_REDIRECT,
  ADMIN_CONSOLE_COOKIE_NAME,
  isAdminConsoleConfigured,
  isValidAdminConsoleSession,
  normalizeAdminReturnTo,
} from "@/lib/adminAuth";
import { PRODUCT_MANAGEMENT_FLYOUT_GROUPS } from "@/lib/productManagementNav";

export const metadata: Metadata = {
  title: "管理控制台登录 · 予选",
  description: "管理员入口，统一进入产品管理、数据分析、矩阵测试与工程脉冲。",
};

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

function queryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function errorMessage(code: string | undefined): string | null {
  if (!code) return null;
  if (code === "missing-password") return "请输入管理密码。";
  if (code === "invalid-password") return "管理密码错误。";
  if (code === "config-missing") return "服务端未配置 ADMIN_CONSOLE_PASSWORD，无法登录。";
  return "登录失败，请重试。";
}

export default async function AuthPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const search = (await Promise.resolve(searchParams)) || {};
  const returnTo = normalizeAdminReturnTo(queryValue(search.returnTo));
  const authError = errorMessage(queryValue(search.error));
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_CONSOLE_COOKIE_NAME)?.value;
  const authenticated = await isValidAdminConsoleSession(session);
  const configured = isAdminConsoleConfigured();

  return (
    <section className="mx-auto max-w-[1180px] px-6 pb-20 pt-12 md:px-10">
      <header className="rounded-[32px] border border-black/10 bg-white p-7 shadow-[0_18px_44px_rgba(16,24,40,0.08)]">
        <div className="text-[12px] font-semibold tracking-[0.12em] uppercase text-black/46">ADMIN CONSOLE</div>
        <h1 className="mt-2 text-[42px] font-semibold tracking-[-0.03em] text-black/90">管理控制台</h1>
        <p className="mt-3 max-w-[760px] text-[15px] leading-[1.7] text-black/62">
          产品管理、数据分析、矩阵测试、工程脉冲统一归到管理员后台。登录一次后会记录浏览器 cookie，默认 30 天内免重复登录。
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="rounded-full border border-black/12 bg-white px-4 py-1.5 text-[12px] font-medium text-black/72 hover:bg-black/[0.03]"
          >
            返回 Desktop 首页
          </Link>
          <Link
            href="/m"
            className="rounded-full border border-black/12 bg-white px-4 py-1.5 text-[12px] font-medium text-black/72 hover:bg-black/[0.03]"
          >
            进入 Mobile 首页
          </Link>
          {authenticated ? (
            <form action="/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-full border border-black/12 bg-black px-4 py-1.5 text-[12px] font-medium text-white hover:bg-black/86"
              >
                退出管理登录
              </button>
            </form>
          ) : null}
        </div>
      </header>

      {!configured ? (
        <section className="mt-6 rounded-[24px] border border-[#efc0ba] bg-[#fff4f2] px-5 py-4 text-[#7f2b21]">
          <div className="text-[13px] font-semibold">未配置管理员密码</div>
          <p className="mt-2 text-[12px] leading-[1.6]">
            需要在 `frontend` 容器环境配置 `ADMIN_CONSOLE_PASSWORD`。已在仓库新增 `.env.example`，复制后设置真实密码即可。
          </p>
        </section>
      ) : null}

      {!authenticated ? (
        <section className="mt-6 rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_18px_44px_rgba(16,24,40,0.06)]">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-black/88">输入管理密码</h2>
          <p className="mt-2 text-[13px] leading-[1.65] text-black/60">通过后将自动跳转到后台目标页，并写入 httpOnly cookie。</p>
          {authError ? (
            <div className="mt-4 rounded-2xl border border-[#efc0ba] bg-[#fff4f2] px-4 py-3 text-[12px] text-[#7f2b21]">{authError}</div>
          ) : null}
          <form action="/auth/login" method="post" className="mt-5 space-y-4">
            <input type="hidden" name="returnTo" value={returnTo} />
            <label className="block">
              <div className="text-[12px] font-medium text-black/66">管理密码</div>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                className="mt-2 h-11 w-full rounded-2xl border border-black/12 px-4 text-[14px] outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
                placeholder="请输入管理员密码"
                required
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-full border border-black bg-black px-5 text-[13px] font-semibold text-white hover:bg-black/86"
            >
              进入管理控制台
            </button>
          </form>
        </section>
      ) : (
        <section className="mt-6 space-y-6">
          <div className="rounded-[24px] border border-[#cbe7d8] bg-[#eff8f2] px-5 py-4 text-[#1f6a4e]">
            <div className="text-[13px] font-semibold">已登录管理员后台</div>
            <p className="mt-1 text-[12px]">
              当前 cookie 有效期 30 天。若修改 `ADMIN_CONSOLE_PASSWORD`，已登录 cookie 会自动失效。
            </p>
            <Link
              href={returnTo || ADMIN_CONSOLE_DEFAULT_REDIRECT}
              className="mt-3 inline-flex h-9 items-center justify-center rounded-full border border-[#8dc8aa] bg-white px-4 text-[12px] font-semibold text-[#1f6a4e] hover:bg-[#f8fffb]"
            >
              继续前往：{returnTo || ADMIN_CONSOLE_DEFAULT_REDIRECT}
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_18px_44px_rgba(16,24,40,0.06)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/44">PRODUCT MANAGEMENT</div>
              <h3 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-black/88">产品管理</h3>
              <p className="mt-2 text-[13px] leading-[1.62] text-black/62">上传、治理、成分治理三条工作线统一放在产品后台。</p>
              <div className="mt-4 space-y-3">
                {PRODUCT_MANAGEMENT_FLYOUT_GROUPS.map((group) => (
                  <div key={group.key} className="rounded-2xl border border-black/8 bg-[#f7f8fb] px-4 py-3">
                    <div className="text-[13px] font-semibold text-black/82">{group.titleZh}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {group.items.map((item) => (
                        <Link
                          key={`${group.key}:${item.href}:${item.labelZh}`}
                          href={item.href}
                          className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/68 hover:bg-black/[0.03]"
                        >
                          {item.labelZh}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_18px_44px_rgba(16,24,40,0.06)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/44">ANALYTICS</div>
              <h3 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-black/88">数据分析</h3>
              <p className="mt-2 text-[13px] leading-[1.62] text-black/62">按功能分块，先看实时看板，再看信号、蓝图和完全体目标。</p>
              <div className="mt-4 grid gap-3">
                {ANALYTICS_SECTIONS.map((section) => (
                  <Link
                    key={section.key}
                    href={section.href}
                    className="rounded-2xl border border-black/8 bg-[#f7f8fb] px-4 py-3 hover:bg-[#eef4ff]"
                  >
                    <div className="text-[13px] font-semibold text-black/82">{section.titleZh}</div>
                    <p className="mt-1 text-[12px] leading-[1.55] text-black/60">{section.summaryZh}</p>
                  </Link>
                ))}
              </div>
            </article>

            <article className="rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_18px_44px_rgba(16,24,40,0.06)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/44">MATRIX TEST</div>
              <h3 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-black/88">矩阵测试</h3>
              <p className="mt-2 text-[13px] leading-[1.62] text-black/62">用于规则回归、批量 CSV 测试、边界样本观察。</p>
              <Link
                href="/matrix-test"
                className="mt-4 inline-flex h-9 items-center justify-center rounded-full border border-black bg-black px-4 text-[12px] font-semibold text-white hover:bg-black/86"
              >
                打开矩阵测试台
              </Link>
            </article>

            <article className="rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_18px_44px_rgba(16,24,40,0.06)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/44">GIT PULSE</div>
              <h3 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-black/88">工程脉冲</h3>
              <p className="mt-2 text-[13px] leading-[1.62] text-black/62">查看近期代码 churn、模块分布和高影响提交 diff。</p>
              <Link
                href="/git"
                className="mt-4 inline-flex h-9 items-center justify-center rounded-full border border-black bg-black px-4 text-[12px] font-semibold text-white hover:bg-black/86"
              >
                打开工程脉冲
              </Link>
            </article>
          </div>
        </section>
      )}
    </section>
  );
}
