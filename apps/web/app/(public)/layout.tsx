import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CompareProvider } from "@/components/CompareProvider";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <CompareProvider>
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </div>
    </CompareProvider>
  );
}
