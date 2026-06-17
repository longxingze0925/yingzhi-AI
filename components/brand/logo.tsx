import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  href = "/",
  showText = true,
}: {
  className?: string;
  href?: string;
  showText?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-2.5", className)}
    >
      <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-brand-gradient shadow-lg shadow-brand-violet/30 transition-transform duration-300 group-hover:scale-105">
        <span className="absolute inset-0 noise opacity-40" />
        <LogoMark className="relative h-5 w-5 text-white" />
      </span>
      {showText && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-tight">影织</span>
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Shadowweave
          </span>
        </span>
      )}
    </Link>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* 经纬交织的「织」意象 */}
      <path
        d="M4 7c4 2.5 12 2.5 16 0M4 12c4 2.5 12 2.5 16 0M4 17c4 2.5 12 2.5 16 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M8 4.5c-1.5 5-1.5 10 0 15M16 4.5c1.5 5 1.5 10 0 15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}
