import { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";

type NavItem = {
  label: string;
  to: string;
  matchPrefix?: string;
};

function BrandLogo() {
  return (
    <img 
      src="/logo.png" 
      alt="Brand Logo" 
      className="h-[44px] w-[44px] rounded-full object-cover"
    />
  );
}

function isActivePath(pathname: string, item: NavItem) {
  if (item.matchPrefix) return pathname.startsWith(item.matchPrefix);
  return pathname === item.to;
}

export default function AdminNavbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: NavItem[] = useMemo(
    () => [
      { label: "Home", to: "/admin/home" },
      {
        label: "Artist Applications",
        to: "/admin/artist-applications",
        matchPrefix: "/admin/artist-applications"
      },
      { label: "Artists", to: "/admin/artists", matchPrefix: "/admin/artists" },
      { label: "Featured Artists", to: "/admin/featured-artists" },
      { label: "Content Moderation", to: "/admin/moderation" },
      { label: "Platform Plan", to: "/admin/subscription-settings" },
      { label: "Analytics", to: "/admin/analytics" },
      { label: "Audit Logs", to: "/admin/audit" }
    ],
    []
  );

  const onLogout = () => {
    localStorage.removeItem("adminToken");
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#4b1927]">
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage: "url(/image_77cf67.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat"
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(193,117,86,0.18)_0%,rgba(75,25,39,0.85)_55%,rgba(10,8,8,0.95)_100%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <BrandLogo />
            <div className="hidden sm:block">
              <div className="text-[13px] tracking-wide text-[#e6d6d2]">Admin</div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const active = isActivePath(pathname, item);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`px-3 py-2 text-[13px] tracking-wide transition-colors border-b-2 ${
                    active
                      ? "text-white border-[#cfa99f]"
                      : "text-[#e0c7c0] border-transparent hover:text-white hover:border-white/30"
                  }`}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onLogout}
              className="hidden md:inline-flex h-[38px] items-center rounded-[8px] border border-white/10 bg-[#141010]/35 px-4 text-[13px] text-[#d8c7c3] hover:text-white hover:bg-white/5"
            >
              Logout
            </button>

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden inline-flex h-[38px] w-[42px] items-center justify-center rounded-[8px] border border-white/10 bg-[#141010]/35 text-[#d8c7c3] hover:text-white hover:bg-white/5"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div className="border-t border-white/10 pb-3 md:hidden">
            <div className="grid gap-1 pt-3">
              {navItems.map((item) => {
                const active = isActivePath(pathname, item);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`px-3 py-2 rounded-[8px] text-[14px] transition-colors border border-transparent ${
                      active
                        ? "bg-white/10 text-white border-white/10"
                        : "text-[#d8c7c3] hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {item.label}
                  </NavLink>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onLogout();
                }}
                className="mt-2 px-3 py-2 rounded-[8px] text-left text-[14px] text-[#d8c7c3] border border-white/10 bg-[#141010]/35 hover:text-white hover:bg-white/5"
              >
                Logout
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
