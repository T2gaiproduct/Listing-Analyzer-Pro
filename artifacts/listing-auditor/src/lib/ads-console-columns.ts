import { useCallback, useMemo, useState } from "react";

export type AdsConsoleColumnDef = {
  id: string;
  label: string;
  defaultVisible?: boolean;
  required?: boolean;
};

export function useAdsConsoleColumns(defs: AdsConsoleColumnDef[]) {
  const [visible, setVisible] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const def of defs) {
      initial[def.id] = def.required ? true : def.defaultVisible !== false;
    }
    return initial;
  });

  const columnOptions = useMemo(
    () =>
      defs.map((def) => ({
        id: def.id,
        label: def.label,
        visible: visible[def.id] ?? true,
        required: def.required,
      })),
    [defs, visible],
  );

  const toggleColumn = useCallback((id: string, nextVisible: boolean) => {
    const def = defs.find((d) => d.id === id);
    if (def?.required) return;
    setVisible((prev) => ({ ...prev, [id]: nextVisible }));
  }, [defs]);

  const isVisible = useCallback((id: string) => visible[id] ?? true, [visible]);

  return { columnOptions, toggleColumn, isVisible };
}
