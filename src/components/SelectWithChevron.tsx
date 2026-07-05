import { useState } from 'react';
import { Select, type SelectProps } from 'antd';
import { ChevronIcon } from './icons';

export default function SelectWithChevron(props: SelectProps) {
  const [open, setOpen] = useState(false);
  const controlled = typeof props.open === 'boolean';
  const actualOpen = controlled ? props.open : open;

  return (
    <Select
      {...props}
      suffixIcon={(
        <ChevronIcon
          className={`select-chevron${actualOpen ? ' select-chevron--open' : ''}`}
        />
      )}
      onOpenChange={(nextOpen) => {
        if (!controlled) setOpen(nextOpen);
        props.onOpenChange?.(nextOpen);
      }}
    />
  );
}
