import { useState, useEffect, useRef } from "react";
import { Palette, Check } from "lucide-react";
import { themes, applyTheme, DEFAULT_THEME_ID } from "../services/themeConfig";

export default function ThemeSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentThemeId, setCurrentThemeId] = useState(DEFAULT_THEME_ID);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("global-theme") || DEFAULT_THEME_ID;
    setCurrentThemeId(savedTheme);
    applyTheme(savedTheme);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectTheme = (id: string) => {
    setCurrentThemeId(id);
    localStorage.setItem("global-theme", id);
    applyTheme(id);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Theme Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300 flex items-center justify-center gap-2"
        title="Change Theme"
      >
        <Palette size={20} className="text-primary animate-pulse" />
        <span className="text-xs font-semibold uppercase tracking-wider hidden md:inline">Theme</span>
      </button>

      {/* Premium Glassmorphic Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-64 rounded-2xl border border-white/10 bg-black/90 backdrop-blur-xl p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 animate-fadeIn overflow-hidden">
          <div className="px-3 py-2 border-b border-white/5">
            <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest">Select Theme</h3>
          </div>
          <div className="mt-1 max-h-80 overflow-y-auto space-y-0.5">
            {themes.map((theme) => {
              const isActive = theme.id === currentThemeId;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => handleSelectTheme(theme.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ${
                    isActive
                      ? "bg-white/10 text-white font-medium"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {/* Theme Color Preview Swatch */}
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%)`,
                    }}
                  />
                  <span className="text-sm text-left flex-1">{theme.name}</span>
                  {isActive && <Check size={16} className="text-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
