import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { fetchJson } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface MemberEmailSuggestion {
  email: string;
  name: string;
  workspaceName: string;
  source: "workspace" | "team";
}

interface MemberEmailAutocompleteProps {
  workspaceId: number;
  value: string;
  onValueChange: (email: string) => void;
  onSuggestionSelect?: (suggestion: MemberEmailSuggestion) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MemberEmailAutocomplete({
  workspaceId,
  value,
  onValueChange,
  onSuggestionSelect,
  placeholder = "user@company.com",
  disabled = false,
}: MemberEmailAutocompleteProps) {
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["workspace-member-suggestions", workspaceId],
    queryFn: () =>
      fetchJson<{ suggestions: MemberEmailSuggestion[] }>(
        `${basePath}/api/workspaces/${workspaceId}/member-suggestions`,
      ),
    enabled: Number.isFinite(workspaceId) && workspaceId > 0,
    staleTime: 60_000,
  });

  const suggestions = data?.suggestions ?? [];

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return suggestions.slice(0, 8);
    return suggestions
      .filter((s) => {
        const email = s.email.toLowerCase();
        const name = s.name.toLowerCase();
        return email.includes(q) || name.includes(q);
      })
      .slice(0, 8);
  }, [suggestions, value]);

  function selectSuggestion(suggestion: MemberEmailSuggestion) {
    onValueChange(suggestion.email);
    onSuggestionSelect?.(suggestion);
    setOpen(false);
  }

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open && filtered.length > 0}
      />
      {open && filtered.length > 0 && (
        <ul
          className="absolute z-20 mt-1 w-full max-h-52 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {filtered.map((suggestion) => (
            <li
              key={suggestion.email}
              role="option"
              className={cn(
                "cursor-pointer px-3 py-2 hover:bg-orange-50",
                value.trim().toLowerCase() === suggestion.email.toLowerCase() && "bg-orange-50/60",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(suggestion);
              }}
            >
              <p className="text-sm font-medium text-slate-900">{suggestion.email}</p>
              <p className="text-xs text-slate-500">
                {suggestion.name}
                {suggestion.workspaceName ? ` · ${suggestion.workspaceName}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
