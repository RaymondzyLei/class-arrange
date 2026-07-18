import type { MouseEvent } from 'react';
import { StarIcon } from './icons';

interface FavoriteButtonProps {
  active: boolean;
  label: string;
  onToggle: () => void;
  className?: string;
  dataTour?: string;
}

function stopEvent(event: MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
  event.stopPropagation();
}

export function FavoriteButton({
  active,
  label,
  onToggle,
  className,
  dataTour,
}: FavoriteButtonProps) {
  const classes = [
    'favorite-button',
    active && 'favorite-button--active',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={classes}
      aria-pressed={active}
      aria-label={label}
      title={label}
      data-tour={dataTour}
      onMouseDown={stopEvent}
      onClick={(event) => {
        stopEvent(event);
        onToggle();
      }}
    >
      <StarIcon filled={active} />
    </button>
  );
}
