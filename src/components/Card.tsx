import Link from "next/link";
import type { ReactNode } from "react";

type CardProps = {
  href?: string;
  children: ReactNode;
  className?: string;
};

export function Card({ href, children, className = "" }: CardProps) {
  const cls = `block border border-line bg-zand p-5 transition-colors duration-300 ease-staudt ${
    href ? "hover:border-navy hover:bg-white" : ""
  } ${className}`;

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return <div className={cls}>{children}</div>;
}

type SectionProps = {
  eyebrow?: string;
  title?: string;
  children: ReactNode;
  className?: string;
};

export function Section({ eyebrow, title, children, className = "" }: SectionProps) {
  return (
    <section className={`mb-10 ${className}`}>
      {eyebrow ? <div className="eyebrow mb-2">{eyebrow}</div> : null}
      {title ? (
        <h2
          className="mb-5 font-black tracking-tight text-black"
          style={{ fontSize: "1.6rem", lineHeight: 1.2 }}
        >
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

type EmptyProps = {
  title: string;
  description?: string;
  children?: ReactNode;
};

export function EmptyState({ title, description, children }: EmptyProps) {
  return (
    <div className="border border-dashed border-taupe bg-zand/40 px-6 py-12 text-center">
      <h3
        className="mb-2 font-black tracking-tight text-black"
        style={{ fontSize: "1.15rem" }}
      >
        {title}
      </h3>
      {description ? (
        <p className="mx-auto max-w-md text-sm leading-relaxed text-body">
          {description}
        </p>
      ) : null}
      {children ? <div className="mt-6 flex justify-center">{children}</div> : null}
    </div>
  );
}
