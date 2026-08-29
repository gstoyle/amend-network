import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logoutAction} className={cn("w-full", className)}>
      <Button className="w-full justify-start" type="submit" variant="ghost">
        Log out
      </Button>
    </form>
  );
}
