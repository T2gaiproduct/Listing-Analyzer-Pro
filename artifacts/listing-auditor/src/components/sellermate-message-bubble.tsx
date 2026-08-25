import { cn } from "@/lib/utils";
import {
  parseSellermateMessageMetadata,
  type SellermateMessageMetadata,
  type SellermateResultOption,
} from "@/lib/sellermate-message-types";

type SellermateMessageBubbleProps = {
  role: string;
  content: string;
  metadata?: string | SellermateMessageMetadata | null;
  messageId?: number;
  onSelectOption?: (input: { optionId: string; messageId: number; option: SellermateResultOption }) => void;
  isSelectingOption?: boolean;
  disabledOptionIds?: string[];
};

function resolveMetadata(metadata?: string | SellermateMessageMetadata | null): SellermateMessageMetadata | null {
  if (!metadata) return null;
  if (typeof metadata === "string") return parseSellermateMessageMetadata(metadata);
  return metadata;
}

export function SellermateMessageBubble({
  role,
  content,
  metadata,
  messageId,
  onSelectOption,
  isSelectingOption,
  disabledOptionIds = [],
}: SellermateMessageBubbleProps) {
  const isUser = role === "user";
  const meta = resolveMetadata(metadata);

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[90%] rounded-2xl px-4 py-3 text-sm",
          isUser
            ? "bg-orange-500 text-white whitespace-pre-wrap"
            : "bg-white border border-slate-200 text-slate-800 shadow-sm space-y-3",
        )}
      >
        <p className={cn(isUser ? "" : "whitespace-pre-wrap")}>{content}</p>

        {!isUser && meta?.phase === "clarifying" && meta.questions && meta.questions.length > 0 && (
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">To help you better</p>
            <ol className="list-decimal list-inside space-y-1 text-slate-700">
              {meta.questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ol>
          </div>
        )}

        {!isUser && meta?.phase === "presenting_options" && meta.options && meta.options.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pick the option you prefer</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {meta.options.map((option) => {
                const disabled = disabledOptionIds.includes(option.id) || isSelectingOption;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={disabled || !messageId || !onSelectOption}
                    onClick={() => {
                      if (!messageId || !onSelectOption) return;
                      onSelectOption({ optionId: option.id, messageId, option });
                    }}
                    className={cn(
                      "text-left rounded-xl border px-3 py-2.5 transition-colors",
                      disabled
                        ? "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed"
                        : "border-orange-200 bg-orange-50/40 hover:bg-orange-50 hover:border-orange-300",
                    )}
                  >
                    <p className="text-xs font-semibold text-orange-700 uppercase">{option.id}</p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5">{option.title}</p>
                    {option.summary && (
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">{option.summary}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
