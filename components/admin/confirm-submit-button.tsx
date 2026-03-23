"use client";

import { type MouseEvent, type ReactNode } from "react";

type Props = {
  confirmMessage: string;
  className?: string;
  children: ReactNode;
};

export function ConfirmSubmitButton({
  confirmMessage,
  className,
  children,
}: Props) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (!window.confirm(confirmMessage)) {
      event.preventDefault();
    }
  }

  return (
    <button type="submit" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
