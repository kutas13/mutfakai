"use client";

import type { ButtonHTMLAttributes } from "react";

type ToggleProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pressed?: boolean;
};

export function Toggle({
  pressed = false,
  className = "",
  children,
  ...props
}: ToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={[
        "inline-flex min-h-11 items-center rounded-full border px-3 py-2 text-sm font-medium transition",
        pressed
          ? "border-[#2D5A27] bg-[#2D5A27] text-white"
          : "border-neutral-300 bg-white text-neutral-800 hover:border-[#2D5A27]/40",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
