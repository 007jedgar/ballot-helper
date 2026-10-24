/** Ballot going into a ballot box. Also served as the favicon (src/app/icon.svg). */
export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#5e6ad2" />
      <rect x="9.5" y="5" width="13" height="15" rx="1.75" fill="#fff" />
      <path d="M12.5 11.6l2.4 2.4 4.6-5" fill="none" stroke="#5e6ad2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="6" y="17.5" width="20" height="9.5" rx="2" fill="#16182b" />
      <rect x="9" y="17.5" width="14" height="1.6" rx=".8" fill="#5e6ad2" opacity=".55" />
    </svg>
  );
}
