import Link from "next/link";
import { Logo } from "./Logo";

export function MobileNav() {
  return (
    <div className="md:hidden flex items-center gap-3 border-b border-line px-4 py-2.5 text-sm">
      <Link href="/" className="flex items-center gap-1.5 font-serif font-semibold"><Logo size={18} /> FrostedFlakes</Link>
      <span className="flex-1" />
      <Link href="/ask" className="text-ink-soft">Ask</Link>
      <Link href="/templates" className="text-ink-soft">Templates</Link>
      <Link href="/settings" className="text-ink-soft">Settings</Link>
    </div>
  );
}
