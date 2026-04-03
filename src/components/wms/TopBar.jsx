import { Menu, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TopBar({ onMenuClick, title }) {
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
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-wms-danger rounded-full" />
        </Button>
      </div>
    </header>
  );
}