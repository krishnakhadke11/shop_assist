// The call button — one meaning only: this places a call. Icon-only per
// direct design feedback; the calling screen/list around it still carries
// the shop name and open/closed state, so the icon isn't the only signal.
// Glyph is a mic (not a phone handset) because the underlying action is a
// voice call the AI assistant listens in on — see the "An AI assistant
// listens..." copy on the Home screen's value banner.

interface PhoneIconProps {
  className?: string;
  size?: number;
}

export function PhoneIcon({ className, size = 20 }: PhoneIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <path d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-.53 1.47l-1.44 1.16a10.65 10.65 0 006.095 6.095l1.16-1.44a1.5 1.5 0 011.47-.53l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A17.001 17.001 0 012.43 6.326 17.03 17.03 0 012 3.5z" />
    </svg>
  );
}

export function MicIcon({ className, size = 20 }: PhoneIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <path d="M10 12.5a3 3 0 003-3V5a3 3 0 10-6 0v4.5a3 3 0 003 3z" />
      <path d="M5.5 9.5a.75.75 0 00-1.5 0 6 6 0 005.25 5.955V17H7a.75.75 0 000 1.5h6a.75.75 0 000-1.5h-2.25v-1.545A6 6 0 0016 9.5a.75.75 0 00-1.5 0 4.5 4.5 0 01-9 0z" />
    </svg>
  );
}

interface CallButtonProps {
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
  title?: string;
  size?: number;
}

export function CallButton({ onClick, disabled, ariaLabel, title, size = 48 }: CallButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      className={`flex-none flex items-center justify-center rounded-full transition-shadow disabled:cursor-not-allowed ${
        disabled ? 'bg-gray-200' : 'bg-brand shadow-[0_0_0_6px_rgba(128,195,65,0.18)]'
      }`}
      style={{ width: size, height: size }}
    >
      <MicIcon
        className={disabled ? 'text-gray-400' : 'text-white'}
        size={Math.round(size * 0.45)}
      />
    </button>
  );
}
