declare module 'lucide-react-native' {
  import * as React from 'react';

  export interface LucideProps {
    color?: string;
    fill?: string;
    size?: number;
    strokeWidth?: number;
    absoluteStrokeWidth?: boolean;
    style?: any;
  }

  export type LucideIcon = React.FC<LucideProps>;

  export const WifiOff: LucideIcon;
  export const RefreshCw: LucideIcon;

  export const Home: LucideIcon;
  export const Library: LucideIcon;
  export const Search: LucideIcon;
  export const User: LucideIcon;
  export const Music: LucideIcon;
  export const PlayCircle: LucideIcon;

  export const Instagram: LucideIcon;
  export const Youtube: LucideIcon;

  export const CreditCard: LucideIcon;
  export const HelpCircle: LucideIcon;
  export const LogOut: LucideIcon;
  export const Lock: LucideIcon;
  export const ShieldX: LucideIcon;
  export const Mail: LucideIcon;

  export const ArrowLeft: LucideIcon;
  export const BadgeCheck: LucideIcon;
  export const Pause: LucideIcon;
  export const Play: LucideIcon;
  export const Settings: LucideIcon;
  export const SkipForward: LucideIcon;
  export const SkipBack: LucideIcon;
  export const Maximize: LucideIcon;
  export const Minimize: LucideIcon;

  export const AlertTriangle: LucideIcon;
  export const Crown: LucideIcon;

  export const Eye: LucideIcon;
  export const EyeOff: LucideIcon;

  export const X: LucideIcon;
  export const Check: LucideIcon;

  export const Heart: LucideIcon;
  export const Share2: LucideIcon;
  export const Volume2: LucideIcon;
  export const VolumeX: LucideIcon;
  export const Camera: LucideIcon;
}

declare module '*.png' {
  const value: any;
  export default value;
}

declare module '*.jpg' {
  const value: any;
  export default value;
}
