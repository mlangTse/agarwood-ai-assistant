import Link from "next/link";
import { Bot, BookOpenText, GalleryVerticalEnd } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GalleryVerticalEnd className="h-5 w-5" />
          </span>
          <span className="font-serif text-lg font-semibold">沉香 AI 助手</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" asChild>
            <Link href="/guide">
              <BookOpenText className="h-4 w-4" />
              选香指南
            </Link>
          </Button>
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
