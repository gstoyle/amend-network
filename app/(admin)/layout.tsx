import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <header>
        <nav aria-label="Account">
          <Button type="button" variant="ghost">
            Log out
          </Button>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
