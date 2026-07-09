import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

export function SunIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="4.25" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.75v2.1M12 19.15v2.1M4.26 4.26l1.49 1.49M18.25 18.25l1.49 1.49M2.75 12h2.1M19.15 12h2.1M4.26 19.74l1.49-1.49M18.25 5.75l1.49-1.49"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M20.4 14.56A7.85 7.85 0 0 1 9.44 3.6 8.65 8.65 0 1 0 20.4 14.56Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 3.75v10.5M7.6 10.2l4.4 4.4 4.4-4.4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 17.5v1.75c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V17.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WarningIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M10.7 3.95a1.5 1.5 0 0 1 2.6 0l8.2 14.2a1.5 1.5 0 0 1-1.3 2.25H3.8a1.5 1.5 0 0 1-1.3-2.25l8.2-14.2Z"
        fill="currentColor"
      />
      <path
        d="M12 8.2v5.35M12 16.9h.01"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M6.5 9.25 12 14.75l5.5-5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M6.75 6.75 17.25 17.25M17.25 6.75 6.75 17.25"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4.75 6.75h14.5M9.25 6.75V5.5c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1v1.25M17.25 6.75l-.65 12.1c-.03.54-.47.95-1 .95h-7.2c-.53 0-.97-.41-1-.95L6.75 6.75M10.25 10.25v6M13.75 10.25v6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M5.5 12h.01M12 12h.01M18.5 12h.01"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ExternalLinkIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M14.25 6.25h3.5v3.5M17.75 6.25l-7.5 7.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.25 7H7.5C6.67 7 6 7.67 6 8.5v8c0 .83.67 1.5 1.5 1.5h8c.83 0 1.5-.67 1.5-1.5v-4.75"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M9.75 3.75h4.5l.45 2.12c.54.22 1.05.52 1.5.87l2.06-.67 2.25 3.86-1.62 1.46a7.4 7.4 0 0 1 0 1.74l1.62 1.46-2.25 3.86-2.06-.67c-.45.35-.96.65-1.5.87l-.45 2.12h-4.5l-.45-2.12a7.5 7.5 0 0 1-1.5-.87l-2.06.67-2.25-3.86 1.62-1.46a7.4 7.4 0 0 1 0-1.74L3.49 9.93l2.25-3.86 2.06.67c.45-.35.96-.65 1.5-.87l.45-2.12Z"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.25" r="2.75" stroke="currentColor" strokeWidth="1.65" />
    </svg>
  );
}
