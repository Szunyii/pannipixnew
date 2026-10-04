import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ArrowRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12h15.5M14 6.5 19.5 12 14 17.5" />
  </Icon>
);

export const ChevronLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14.5 6 8.5 12l6 6" />
  </Icon>
);

export const ChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9.5 6 6 6-6 6" />
  </Icon>
);

export const ChevronDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9.5 6 6 6-6" />
  </Icon>
);

export const Heart = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p} fill={filled ? "currentColor" : "none"}>
    <path d="M12 20s-7.5-4.4-7.5-10.1A4.15 4.15 0 0 1 12 7.4a4.15 4.15 0 0 1 7.5 2.5C19.5 15.6 12 20 12 20Z" />
  </Icon>
);

export const Bag = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5.5 8.5h13l-.9 12h-11.2Z" />
    <path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" />
  </Icon>
);

export const User = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8.5" r="3.75" />
    <path d="M4.75 20.5c1.2-3.9 4-5.75 7.25-5.75s6.05 1.85 7.25 5.75" />
  </Icon>
);

export const Plus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const Check = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

export const Resize = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 4.5h5.5V10M19.5 4.5l-6.5 6.5M10 19.5H4.5V14M4.5 19.5l6.5-6.5" />
  </Icon>
);

export const Sparkle = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5c.55 4.3 2.45 6.2 6.75 6.75-4.3.55-6.2 2.45-6.75 6.75-.55-4.3-2.45-6.2-6.75-6.75C9.55 9.7 11.45 7.8 12 3.5Z" />
    <path d="M18.5 16.5v3M17 18h3" />
  </Icon>
);

export const Torso = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="4.75" r="2.25" />
    <path d="M9.25 21v-6.25H7.5V10.5A2.5 2.5 0 0 1 10 8h4a2.5 2.5 0 0 1 2.5 2.5v4.25h-1.75V21" />
    <path d="M12 14.75V21" />
  </Icon>
);

export const Menu = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9h16M4 15h16" />
  </Icon>
);

export const Close = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const Instagram = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="4" width="16" height="16" rx="4.5" />
    <circle cx="12" cy="12" r="3.6" />
    <circle cx="16.8" cy="7.2" r=".6" fill="currentColor" stroke="none" />
  </Icon>
);

export const Mail = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
    <path d="m4 7 8 6 8-6" />
  </Icon>
);
