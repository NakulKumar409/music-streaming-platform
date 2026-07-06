export interface ThemeDefinition {
  id: string;
  name: string;
  primary: string;
  primaryRgb: string;
  secondary: string;
  secondaryRgb: string;
  accent: string;
  accentRgb: string;
  accentHover: string;
  accentActive: string;
  gradientStart: string;
  gradientEnd: string;
  chartColors: string[];
  
  bg: string;
  bgRgb: string;
  surface: string;
  surfaceRgb: string;
  card: string;
  cardRgb: string;
}

export const themes: ThemeDefinition[] = [
  {
    id: "ocean-blue",
    name: "Ocean Blue",
    primary: "#0082FF",
    primaryRgb: "0 130 255",
    secondary: "#00E5FF",
    secondaryRgb: "0 229 255",
    accent: "#00C8FF",
    accentRgb: "0 200 255",
    accentHover: "#33D6FF",
    accentActive: "#00A3D1",
    gradientStart: "#0082FF",
    gradientEnd: "#00E5FF",
    chartColors: ["#0082FF", "#00E5FF", "#00C8FF"],
    bg: "#0A1224",
    bgRgb: "10 18 36",
    surface: "#121D33",
    surfaceRgb: "18 29 51",
    card: "#172541",
    cardRgb: "23 37 65"
  },
  {
    id: "emerald-green",
    name: "Emerald Green",
    primary: "#00C853",
    primaryRgb: "0 200 83",
    secondary: "#00E676",
    secondaryRgb: "0 230 118",
    accent: "#00E676",
    accentRgb: "0 230 118",
    accentHover: "#33EB91",
    accentActive: "#00B35C",
    gradientStart: "#00C853",
    gradientEnd: "#00E676",
    chartColors: ["#00C853", "#00E676", "#33EB91"],
    bg: "#06120C",
    bgRgb: "6 18 12",
    surface: "#0C1F16",
    surfaceRgb: "12 31 22",
    card: "#122B1F",
    cardRgb: "18 43 31"
  },
  {
    id: "purple-galaxy",
    name: "Purple Galaxy",
    primary: "#7B1FA2",
    primaryRgb: "123 31 162",
    secondary: "#E040FB",
    secondaryRgb: "224 64 251",
    accent: "#D500F9",
    accentRgb: "213 0 249",
    accentHover: "#DD33FA",
    accentActive: "#A300BF",
    gradientStart: "#7B1FA2",
    gradientEnd: "#E040FB",
    chartColors: ["#7B1FA2", "#E040FB", "#D500F9"],
    bg: "#0D0818",
    bgRgb: "13 8 24",
    surface: "#160F27",
    surfaceRgb: "22 15 39",
    card: "#1E1533",
    cardRgb: "30 21 51"
  },
  {
    id: "sunset-orange",
    name: "Sunset Orange",
    primary: "#E85D2C",
    primaryRgb: "232 93 44",
    secondary: "#C97A54",
    secondaryRgb: "201 122 84",
    accent: "#FF7A2F",
    accentRgb: "255 122 47",
    accentHover: "#FF9B5C",
    accentActive: "#D34B1A",
    gradientStart: "#E85D2C",
    gradientEnd: "#C97A54",
    chartColors: ["#E85D2C", "#C97A54", "#FF7A2F"],
    bg: "#0A0A0A",
    bgRgb: "10 10 10",
    surface: "#15100E",
    surfaceRgb: "21 16 14",
    card: "#181818",
    cardRgb: "24 24 24"
  },
  {
    id: "crimson-red",
    name: "Crimson Red",
    primary: "#D50000",
    primaryRgb: "213 0 0",
    secondary: "#FF5252",
    secondaryRgb: "255 82 82",
    accent: "#FF1744",
    accentRgb: "255 23 68",
    accentHover: "#FF456A",
    accentActive: "#B2102F",
    gradientStart: "#D50000",
    gradientEnd: "#FF5252",
    chartColors: ["#D50000", "#FF5252", "#FF1744"],
    bg: "#120606",
    bgRgb: "18 6 6",
    surface: "#1F0C0C",
    surfaceRgb: "31 12 12",
    card: "#2B1212",
    cardRgb: "43 18 18"
  },
  {
    id: "teal-cyan",
    name: "Teal Cyan",
    primary: "#00BFA5",
    primaryRgb: "0 191 165",
    secondary: "#1DE9B6",
    secondaryRgb: "29 233 182",
    accent: "#00E5FF",
    accentRgb: "0 229 255",
    accentHover: "#33EBF7",
    accentActive: "#00A3B3",
    gradientStart: "#00BFA5",
    gradientEnd: "#1DE9B6",
    chartColors: ["#00BFA5", "#1DE9B6", "#00E5FF"],
    bg: "#041010",
    bgRgb: "4 16 16",
    surface: "#081C1C",
    surfaceRgb: "8 28 28",
    card: "#0C2828",
    cardRgb: "12 40 40"
  },
  {
    id: "royal-blue",
    name: "Royal Blue",
    primary: "#2979FF",
    primaryRgb: "41 121 255",
    secondary: "#3D5AFE",
    secondaryRgb: "61 90 254",
    accent: "#2979FF",
    accentRgb: "41 121 255",
    accentHover: "#5393FF",
    accentActive: "#1C54B2",
    gradientStart: "#2979FF",
    gradientEnd: "#3D5AFE",
    chartColors: ["#2979FF", "#3D5AFE", "#5393FF"],
    bg: "#080C18",
    bgRgb: "8 12 24",
    surface: "#0E1426",
    surfaceRgb: "14 20 38",
    card: "#141C33",
    cardRgb: "20 28 51"
  },
  {
    id: "midnight-black",
    name: "Midnight Black",
    primary: "#757575",
    primaryRgb: "117 117 117",
    secondary: "#424242",
    secondaryRgb: "66 66 66",
    accent: "#757575",
    accentRgb: "117 117 117",
    accentHover: "#9E9E9E",
    accentActive: "#424242",
    gradientStart: "#212121",
    gradientEnd: "#424242",
    chartColors: ["#212121", "#424242", "#757575"],
    bg: "#080808",
    bgRgb: "8 8 8",
    surface: "#101010",
    surfaceRgb: "16 16 16",
    card: "#181818",
    cardRgb: "24 24 24"
  },
  {
    id: "rose-pink",
    name: "Rose Pink",
    primary: "#C2185B",
    primaryRgb: "194 24 91",
    secondary: "#FF4081",
    secondaryRgb: "255 64 129",
    accent: "#FF4081",
    accentRgb: "255 64 129",
    accentHover: "#FF669A",
    accentActive: "#B22C5A",
    gradientStart: "#C2185B",
    gradientEnd: "#FF4081",
    chartColors: ["#C2185B", "#FF4081", "#FF669A"],
    bg: "#12060E",
    bgRgb: "18 6 14",
    surface: "#1F0C18",
    surfaceRgb: "31 12 24",
    card: "#2B1221",
    cardRgb: "43 18 33"
  },
  {
    id: "golden-amber",
    name: "Golden Amber",
    primary: "#FF8F00",
    primaryRgb: "255 143 0",
    secondary: "#FFB300",
    secondaryRgb: "255 179 0",
    accent: "#FFAB00",
    accentRgb: "255 171 0",
    accentHover: "#FFBB33",
    accentActive: "#B27700",
    gradientStart: "#FF8F00",
    gradientEnd: "#FFB300",
    chartColors: ["#FF8F00", "#FFB300", "#FFAB00"],
    bg: "#0F0C08",
    bgRgb: "15 12 8",
    surface: "#1A150F",
    surfaceRgb: "26 21 15",
    card: "#241E16",
    cardRgb: "36 30 22"
  }
];

export const DEFAULT_THEME_ID = "sunset-orange";

export function applyTheme(themeId: string) {
  const selectedTheme = themes.find(t => t.id === themeId) || themes[3];
  
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', selectedTheme.primary);
    root.style.setProperty('--color-primary-rgb', selectedTheme.primaryRgb);
    root.style.setProperty('--color-secondary', selectedTheme.secondary);
    root.style.setProperty('--color-secondary-rgb', selectedTheme.secondaryRgb);
    root.style.setProperty('--color-accent', selectedTheme.accent);
    root.style.setProperty('--color-accent-rgb', selectedTheme.accentRgb);
    root.style.setProperty('--color-accent-hover', selectedTheme.accentHover);
    root.style.setProperty('--color-accent-active', selectedTheme.accentActive);
    
    // Background and Surfaces
    root.style.setProperty('--color-bg', selectedTheme.bg);
    root.style.setProperty('--color-bg-rgb', selectedTheme.bgRgb);
    root.style.setProperty('--color-surface', selectedTheme.surface);
    root.style.setProperty('--color-surface-rgb', selectedTheme.surfaceRgb);
    root.style.setProperty('--color-card', selectedTheme.card);
    root.style.setProperty('--color-card-rgb', selectedTheme.cardRgb);
    
    // Gradients
    root.style.setProperty('--gradient-primary-start', selectedTheme.gradientStart);
    root.style.setProperty('--gradient-primary-end', selectedTheme.gradientEnd);
    root.style.setProperty('--gradient-primary', `linear-gradient(135deg, ${selectedTheme.gradientStart} 0%, ${selectedTheme.gradientEnd} 100%)`);
    root.style.setProperty('--gradient-bg-1', selectedTheme.bg);
    root.style.setProperty('--gradient-bg-2', selectedTheme.surface);
    root.style.setProperty('--gradient-bg-3', selectedTheme.bg);
  }
}
