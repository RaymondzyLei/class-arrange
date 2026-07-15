import { useState } from 'react';
import { Select, type SelectProps } from 'antd';
import { ChevronIcon } from './icons';

function getDefaultPopupContainer(triggerNode: HTMLElement): HTMLElement {
  return triggerNode.closest('.bottom-modal, .onboarding-wizard') as HTMLElement
    ?? document.body;
}

export default function SelectWithChevron(props: SelectProps) {
  const { getPopupContainer, onOpenChange, open: openProp, ...restProps } = props;
  const [open, setOpen] = useState(false);
  const controlled = typeof openProp === 'boolean';
  const actualOpen = controlled ? openProp : open;

  return (
    <Select
      {...restProps}
      open={openProp}
      getPopupContainer={getPopupContainer ?? getDefaultPopupContainer}
      suffixIcon={(
        <ChevronIcon
          className={`select-chevron${actualOpen ? ' select-chevron--open' : ''}`}
        />
      )}
      onOpenChange={(nextOpen) => {
        if (!controlled) setOpen(nextOpen);
        onOpenChange?.(nextOpen);
      }}
    />
  );
}
