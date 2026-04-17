"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SearchBoxProps = {
  defaultValue?: string;
};

export function SearchBox({ defaultValue = "" }: SearchBoxProps) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const q = value.trim();
        if (q) router.push(`/?q=${encodeURIComponent(q)}`);
        else router.push("/");
      }}
      className="flex w-full items-stretch border border-line bg-white"
    >
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Zoek op serienummer…"
        className="flex-1 bg-transparent px-4 py-3 text-base text-black outline-none placeholder:text-muted"
      />
      <button
        type="submit"
        className="btn-label border-l border-line px-4 text-navy transition-colors duration-300 ease-staudt hover:bg-navy hover:text-white"
      >
        Zoek
      </button>
    </form>
  );
}
