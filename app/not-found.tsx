import Link from "next/link";
import { Home, Compass } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { AuroraBackground } from "@/components/brand/backgrounds";

export default function NotFound() {
  return (
    <div className="relative grid min-h-screen place-items-center px-6">
      <AuroraBackground />
      <div className="text-center">
        <Logo className="mx-auto" />
        <h1 className="mt-10 text-7xl font-bold tracking-tight text-gradient">
          404
        </h1>
        <p className="mt-4 text-lg font-medium">这一帧暂时无法编织</p>
        <p className="mt-2 text-sm text-muted-foreground">
          你访问的页面不存在或已被移动。
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button asChild variant="brand">
            <Link href="/">
              <Home className="h-4 w-4" /> 返回首页
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/studio/explore">
              <Compass className="h-4 w-4" /> 去灵感广场
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
