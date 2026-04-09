import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TopBar({ onMenuClick, title, onLogout }) {
  return (
    <header className="sticky top-0 z-30 h-16 bg-card/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        {title && <h2 className="text-lg font-semibold hidden sm:block">{title}</h2>}
      </div>
      <div className="flex items-center gap-2">
        {onLogout && (
          <Button variant="ghost" onClick={onLogout} className="gap-2 hidden sm:inline-flex">
            <LogOut className="h-4 w-4" />
            <span>Выход</span>
          </Button>
        )}
      </div>
    </header>
  );
}