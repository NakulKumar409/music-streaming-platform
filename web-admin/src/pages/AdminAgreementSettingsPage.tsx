import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { FileSignature, DollarSign, Shield, FileText } from "lucide-react";
import PageWrapper from "../components/PageWrapper";

export default function AdminAgreementSettingsPage() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    if (location.pathname.includes("commission-plans")) return "commission-plans";
    if (location.pathname.includes("terms")) return "terms";
    if (location.pathname.includes("signed-agreements")) return "signed-agreements";
    return "commission-plans";
  });

  const tabs = [
    {
      id: "commission-plans",
      label: "Commission Plans",
      icon: <DollarSign size={18} />,
      path: "/admin/agreement-settings/commission-plans"
    },
    {
      id: "terms",
      label: "Terms & Conditions",
      icon: <Shield size={18} />,
      path: "/admin/agreement-settings/terms"
    },
    {
      id: "signed-agreements",
      label: "Signed Agreements",
      icon: <FileText size={18} />,
      path: "/admin/agreement-settings/signed-agreements"
    }
  ];

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#E85D2C]/20 text-[#E85D2C]">
            <FileSignature size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Agreement Settings</h1>
            <p className="text-sm text-[#8D7B77]">Manage commission plans, terms, and signed agreements</p>
          </div>
        </div>

        <div className="border-b border-white/10">
          <nav className="flex gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                to={tab.path}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-[#E85D2C] text-[#E85D2C]"
                    : "border-transparent text-[#8D7B77] hover:text-white"
                }`}
              >
                {tab.icon}
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="min-h-[400px]">
          <Outlet />
        </div>
      </div>
    </PageWrapper>
  );
}
