import { ComponentPropsWithoutRef } from "react";

type PanelProps = ComponentPropsWithoutRef<"section"> & {
  className?: string;
};

export function Panel({
  children,
  className = "",
  ...rest
}: PanelProps) {
  return (
    <section className={`panel ${className}`} {...rest}>
      {children}
    </section>
  );
}
