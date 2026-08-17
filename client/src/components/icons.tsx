// Иконки (stroke-based, монохром). currentColor наследует цвет текста.
type P = { size?: number };
const s = (n = 18) => ({ width: n, height: n, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

export const IconDashboard = ({ size }: P) => (
  <svg {...s(size)}><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/></svg>
);
export const IconServers = ({ size }: P) => (
  <svg {...s(size)}><rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/></svg>
);
export const IconCrown = ({ size }: P) => (
  <svg {...s(size)}><path d="M3 7l4 4 5-6 5 6 4-4v11H3z"/></svg>
);
export const IconTeam = ({ size }: P) => (
  <svg {...s(size)}><circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0111 0"/><path d="M16 5.5a3 3 0 010 5.8M17 20a5.5 5.5 0 00-2-4.3"/></svg>
);
export const IconUser = ({ size }: P) => (
  <svg {...s(size)}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></svg>
);
export const IconPlus = ({ size }: P) => (<svg {...s(size)}><path d="M12 5v14M5 12h14"/></svg>);
export const IconClose = ({ size }: P) => (<svg {...s(size)}><path d="M6 6l12 12M18 6L6 18"/></svg>);
export const IconTerminal = ({ size }: P) => (<svg {...s(size)}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/></svg>);
export const IconChevron = ({ size }: P) => (<svg {...s(size)}><path d="M9 6l6 6-6 6"/></svg>);
export const IconLogout = ({ size }: P) => (<svg {...s(size)}><path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/></svg>);
export const IconCheck = ({ size }: P) => (<svg {...s(size)}><path d="M5 12l5 5L20 6"/></svg>);
export const IconRefresh = ({ size }: P) => (<svg {...s(size)}><path d="M20 11a8 8 0 10-2 5.7M20 5v6h-6"/></svg>);
export const IconTrash = ({ size }: P) => (<svg {...s(size)}><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"/></svg>);
