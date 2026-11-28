/** Arrow icon shared by the class node toggle and the side panels (UI14, UI17). */
export function Chevron({ direction }: { direction: 'down' | 'right' | 'left' }) {
  const rotation = { down: 90, right: 0, left: 180 }[direction];
  return (
    <svg
      className="chevron"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden="true"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <path
        d="M 4 2 L 8 6 L 4 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
