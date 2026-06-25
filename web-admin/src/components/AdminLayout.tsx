import { Outlet, useLocation } from "react-router-dom";
import { useState, createContext, useContext } from "react";
import AdminNavbar from "./AdminNavbar";

const SidebarContext = createContext<{ isCollapsed: boolean; toggleSidebar: () => void }>({
  isCollapsed: false,
  toggleSidebar: () => {}
});

export const useSidebar = () => useContext(SidebarContext);

export default function AdminLayout() {
  const { pathname } = useLocation();
  const hideNavbar = pathname === "/admin/login";
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  if (hideNavbar) {
    return <Outlet />;
  }

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar }}>
      <div className="min-h-screen bg-[#0A0A0A]">
        <AdminNavbar />
        <main className={`min-h-screen transition-all duration-300 ${
          isCollapsed ? "md:ml-20" : "md:ml-64"
        }`}>
          <Outlet />
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
