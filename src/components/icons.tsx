type P = React.SVGProps<SVGSVGElement>;
const base = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const IconBack = (p: P) => (
  <svg {...base} {...p}><path d="M15 18l-6-6 6-6" /></svg>
);
export const IconList = (p: P) => (
  <svg {...base} {...p}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>
);
export const IconFullscreen = (p: P) => (
  <svg {...base} {...p}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
);
export const IconExitFullscreen = (p: P) => (
  <svg {...base} {...p}><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>
);
export const IconClose = (p: P) => (
  <svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconPlus = (p: P) => (
  <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconSearch = (p: P) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
);
export const IconUpload = (p: P) => (
  <svg {...base} {...p}><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
);
export const IconGlobe = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></svg>
);
export const IconLock = (p: P) => (
  <svg {...base} {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
);
export const IconAa = (p: P) => (
  <svg {...base} {...p} strokeWidth={1.6}><path d="M3 19l5-13 5 13M5 14h6" /><path d="M15.5 12.5a3 3 0 115 2.2V19M20.5 15.5c-3 0-5 .6-5 2a1.6 1.6 0 003 .8" /></svg>
);

