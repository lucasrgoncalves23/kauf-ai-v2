type SectionLabelProps = {
  children: string;
};

export function SectionLabel({ children }: SectionLabelProps) {
  return (
    <div className="text-2xs tracking-wider uppercase text-slate-400 dark:text-slate-500 font-semibold mb-3">
      {children}
    </div>
  );
}
