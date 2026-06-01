import Link from "next/link";
import { Bot, GalleryVerticalEnd } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GalleryVerticalEnd className="h-5 w-5" />
          </span>
          <span className="font-serif text-lg font-semibold">沉香 AI 助手</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/chat">
              <Bot className="h-4 w-4" />
              AI Chat
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin">后台</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
