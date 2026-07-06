import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState, createContext, useContext } from "react";
import AdminNavbar from "./AdminNavbar";
import ThemeSwitcher from "./ThemeSwitcher";
import { Bell, Settings as SettingsIcon } from "lucide-react";

const SidebarContext = createContext<{ isCollapsed: boolean; toggleSidebar: () => void }>({
  isCollapsed: false,
  toggleSidebar: () => {}
});

export const useSidebar = () => useContext(SidebarContext);

export default function AdminLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const hideNavbar = pathname === "/admin/login";
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  if (hideNavbar) {
    return <Outlet />;
  }

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar }}>
      <div className="min-h-screen bg-background text-white">
        <AdminNavbar />
        <div className={`min-h-screen flex flex-col transition-all duration-300 ${
          isCollapsed ? "md:ml-20" : "md:ml-64"
        }`}>
          {/* Top Navigation Bar */}
          <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-white/5 px-6 h-20 flex items-center justify-between shrink-0">
            <div className="flex-1" />
            <div className="flex items-center gap-4">
              {/* Notifications bell */}
              <button 
                type="button" 
                className="p-2.5 rounded-xl border border-white/5 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all duration-300"
                title="Notifications"
              >
                <Bell size={20} />
              </button>

              {/* Settings gear */}
              <button 
                type="button"
                onClick={() => navigate("/admin/agreement-settings")}
                className="p-2.5 rounded-xl border border-white/5 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all duration-300" 
                title="Settings"
              >
                <SettingsIcon size={20} />
              </button>

              {/* Theme Selector */}
              <ThemeSwitcher />
            </div>
          </header>

          <main className="flex-1 p-6 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}

