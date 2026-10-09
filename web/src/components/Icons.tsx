import type { ReactNode } from 'react';

// Ícones em SVG (traço de 1,75px, herdam a cor do texto). Desenhos no estilo Lucide.

type IconProps = { size?: number; className?: string };

function Svg({ size = 18, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

const icon = (paths: ReactNode) => (p: IconProps) => <Svg {...p}>{paths}</Svg>;

export const IconHome = icon(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v11a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9" /></>);
export const IconList = icon(<><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></>);
export const IconTrend = icon(<><path d="m3 17 6-6 4 4 8-8" /><path d="M14 7h7v7" /></>);
export const IconChart = icon(<><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M8 17v-5M13 17V8M18 17v-9" /></>);
export const IconSettings = icon(<><path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z" /><circle cx="12" cy="12" r="3" /></>);
export const IconPlus = icon(<path d="M12 5v14M5 12h14" />);
export const IconChevronLeft = icon(<path d="m15 18-6-6 6-6" />);
export const IconChevronRight = icon(<path d="m9 18 6-6-6-6" />);
export const IconChevronDown = icon(<path d="m6 9 6 6 6-6" />);
export const IconCheck = icon(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const IconX = icon(<path d="M18 6 6 18M6 6l12 12" />);
export const IconCalendarCheck = icon(<><rect x="3" y="4.5" width="18" height="16.5" rx="2.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /><path d="m9 15 2 2 4-4" /></>);
export const IconCalendar = icon(<><rect x="3" y="4.5" width="18" height="16.5" rx="2.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></>);
export const IconPencil = icon(<><path d="M21.2 6.8a2.8 2.8 0 0 0-4-4L4 16v4h4Z" /><path d="m15 5 4 4" /></>);
export const IconTrash = icon(<><path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></>);
export const IconDots = icon(<><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></>);
export const IconRepeat = icon(<><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></>);
export const IconLock = icon(<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>);
export const IconEye = icon(<><path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.75" /></>);
export const IconEyeOff = icon(<path d="M3 3l18 18M10.6 5.6A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 4M6.6 6.6C3.9 8.3 2.5 12 2.5 12s3.5 6.5 9.5 6.5a9.4 9.4 0 0 0 4.4-1.1M9.9 9.9a2.75 2.75 0 0 0 3.9 3.9" />);
export const IconSun = icon(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>);
export const IconMoon = icon(<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />);
export const IconLogout = icon(<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />);
export const IconSearch = icon(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const IconDownload = icon(<path d="M12 3v12M7 10l5 5 5-5M4 21h16" />);
export const IconUpload = icon(<path d="M12 15V3M7 8l5-5 5 5M4 21h16" />);
export const IconAlert = icon(<><path d="M12 3 2 20.5h20L12 3Z" /><path d="M12 10v4.5M12 17.5v.01" /></>);
export const IconInfo = icon(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>);
export const IconCloud = icon(<path d="M17.5 19H8a6 6 0 1 1 5.7-8h1.8a4 4 0 0 1 2 7.5" />);
export const IconCloudOff = icon(<><path d="m2 2 20 20" /><path d="M5.8 5.8A6 6 0 0 0 8 19h9.5c.4 0 .8 0 1.2-.2M21.5 15a4 4 0 0 0-6-5h-1.8a6 6 0 0 0-3.1-3.3" /></>);
export const IconWallet = icon(<><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></>);
export const IconArrowDown = icon(<path d="M12 5v14M5 12l7 7 7-7" />);
export const IconArrowUp = icon(<path d="M12 19V5M5 12l7-7 7 7" />);
export const IconCopy = icon(<><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2" /></>);
export const IconCircle = icon(<circle cx="12" cy="12" r="8.5" />);
export const IconPiggy = icon(<><path d="M19 9.5c.9.3 2 1.4 2 2.5M5 11a7 7 0 0 1 7-5h2a6 6 0 0 1 6 6v1a3 3 0 0 1-2 2.8V19h-3v-2h-4v2H8v-2.5A6.5 6.5 0 0 1 5 11Z" /><path d="M2 9c0 1.5 1 2.5 3 2.5M15.5 10h.01" /></>);
export const IconFlag = icon(<><path d="M4 22V4a1 1 0 0 1 1-1h12l-2 4 2 4H5" /></>);
export const IconSparkle = icon(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2" />);
