import Image from "next/image";
import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[70px] max-w-3xl items-center justify-center px-5 sm:h-[88px] sm:px-8">
        <Link
          href="/"
          aria-label="Staudt Chronometrie — Testadministratie"
          className="flex items-center"
        >
          <Image
            src="/images/crest-logo-textonly.svg"
            alt="Staudt Chronometrie"
            width={140}
            height={32}
            priority
            className="h-7 w-auto sm:h-8"
          />
        </Link>
      </div>
    </header>
  );
}
