type SectionLabelProps = {
  children: string;
};

export function SectionLabel({ children }: SectionLabelProps) {
  return (
    <div className="text-[11px] tracking-[0.14em] uppercase text-slate-400 dark:text-slate-500 font-bold mb-3 tracking-widest">
      {children}
    </div>
  );
}
