const paths = {
  dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  products: 'm12 3 9 5-9 5-9-5 9-5 M3 8v9l9 5 9-5V8 M12 13v9',
  stock: 'M3 21V8l9-5 9 5v13 M7 21V11h10v10 M7 15h10 M7 19h10',
  orders: 'M6 5h12v16H6z M9 3h6v4H9z M9 11h6 M9 15h6',
  sales: 'M3 4h2l3 12h10l3-8H6 M9 20h.01 M18 20h.01',
  purchases: 'M4 8h16v13H4z M8 8V6a4 4 0 0 1 8 0v2 M12 11v6 M9 14h6',
  suppliers: 'M3 6h12v12H3z M15 10h4l3 4v4h-7 M6 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4 M18 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  cash: 'M3 6h18v14H3z M3 10h18 M15 14h3 M6 16h3',
  expenses: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3 M9 8h6 M9 12h6',
  finance: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  reports: 'M5 3h10l4 4v14H5z M14 3v5h5 M8 17v-4 M12 17v-7 M16 17v-2',
  users: 'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17 4a4 4 0 0 1 0 8 M22 21v-3a4 4 0 0 0-3-4',
  settings: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6',
  audit: 'M4 12a8 8 0 1 0 2-5 M4 3v5h5 M12 8v5l3 2',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  close: 'm6 6 12 12 M6 18 18 6',
  alert: 'm12 3 10 18H2L12 3 M12 9v5 M12 17h.01',
  arrow: 'M5 12h14 m-5-5 5 5-5 5',
} as const;
export type AdminIconName = keyof typeof paths;
export default function AdminIcon({ name }: { name: AdminIconName }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
