import { Outlet, useLocation } from "react-router-dom";
import AdminNavbar from "./AdminNavbar";

export default function AdminLayout() {
  const { pathname } = useLocation();
  const hideNavbar = pathname === "/admin/login";

  return (
    <div className="min-h-screen w-full">
      {hideNavbar ? null : <AdminNavbar />}
      <div>
        <Outlet />
      </div>
    </div>
  );
}
