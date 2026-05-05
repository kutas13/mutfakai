"use client";

import { useEffect, useRef, useState } from "react";

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Ara…",
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? options.filter((o) => o.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR")))
    : options;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => { setQuery(value); }, [value]);

  function pick(v: string) {
    setQuery(v);
    onChange(v);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2D5A27]/25"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
          {filtered.slice(0, 50).map((o) => (
            <li key={o}>
              <button
                type="button"
                onClick={() => pick(o)}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-[#2D5A27]/5"
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
