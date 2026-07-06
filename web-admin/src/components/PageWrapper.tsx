import { ReactNode } from "react";

interface PageWrapperProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export default function PageWrapper({
  children,
  title,
  subtitle,
}: PageWrapperProps) {
  return (
    <div className="min-h-screen w-full bg-background">
      <div className="w-full px-4 sm:px-6 py-6 sm:py-8">
        {title && (
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {title}
            </h1>
            {subtitle && <p className="mt-1 text-[#8D7B77]">{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
