// frontend/components/NavDrawer.tsx
"use client"

import { TAXONOMY } from "@/lib/taxonomy"
import Link from "next/link"

export function NavDrawer({ active }: { active: string | null }) {
  if (!active) return null

  const category = TAXONOMY.find(c => c.slug === active)
  if (!category) return null

  return (
    <div className="absolute left-0 right-0 top-full z-50 border-t border-black/5 bg-white">
      <div className="mx-auto grid max-w-[1100px] grid-cols-3 gap-12 px-8 py-10">
        {category.groups.map(group => (
          <div key={group.title}>
            <h4 className="mb-4 text-[12px] font-medium tracking-[0.04em] text-black/40">
              {group.title}
            </h4>
            <ul className="space-y-2">
              {group.items.map(item => (
                <li key={item.slug}>
                  <Link
                    href={`/c/${category.slug}/${item.slug}`}
                    className="text-[14px] font-medium text-black hover:opacity-60 transition"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}