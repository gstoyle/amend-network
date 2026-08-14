import type { ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";

export default function MemberLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <header>
        <nav aria-label="Account">
          <LogoutButton />
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
