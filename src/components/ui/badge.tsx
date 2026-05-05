"use client";

import type { HTMLAttributes } from "react";

export function Badge({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={[
        "inline-flex min-h-11 items-center rounded-full border border-[#F28C28]/30 bg-[#F28C28]/10 px-3 py-2 text-xs font-semibold text-[#a95e12]",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </span>
  );
}
