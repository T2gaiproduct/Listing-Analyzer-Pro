import { cn } from "@/lib/utils";
import { stripChatMarkdown } from "@/lib/strip-chat-markdown";
import {
  parseSellermateMessageMetadata,
  type SellermateMessageMetadata,
  type SellermateResultOption,
} from "@/lib/sellermate-message-types";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function resolveOptionImageSrc(imageUrl: string): string {
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl;
  if (imageUrl.startsWith("/")) return `${basePath}${imageUrl}`;
  return `${basePath}/${imageUrl}`;
}

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
  const displayContent = stripChatMarkdown(content);

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
        <p className={cn(isUser ? "" : "whitespace-pre-wrap")}>{displayContent}</p>

        {!isUser && meta?.phase === "clarifying" && meta.questions && meta.questions.length > 0 && (
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">To help you better</p>
            <ol className="list-decimal list-inside space-y-1 text-slate-700">
              {meta.questions.map((question) => (
                <li key={question}>{stripChatMarkdown(question)}</li>
              ))}
            </ol>
          </div>
        )}

        {!isUser && meta?.phase === "presenting_options" && meta.options && meta.options.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {meta.options.some((o) => o.imageUrl) ? "Pick the image that looks best" : "Pick the option you prefer"}
            </p>
            <div className={cn(
              "grid gap-2",
              meta.options.some((o) => o.imageUrl) ? "grid-cols-1 sm:grid-cols-2" : "sm:grid-cols-2",
            )}>
              {meta.options.map((option) => {
                const disabled = disabledOptionIds.includes(option.id) || isSelectingOption;
                const imageSrc = option.imageUrl ? resolveOptionImageSrc(option.imageUrl) : null;
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
                      "text-left rounded-xl border overflow-hidden transition-colors",
                      disabled
                        ? "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed"
                        : "border-orange-200 bg-orange-50/40 hover:bg-orange-50 hover:border-orange-300",
                    )}
                  >
                    {imageSrc && (
                      <div className="aspect-square w-full bg-slate-100 border-b border-orange-100">
                        <img
                          src={imageSrc}
                          alt={stripChatMarkdown(option.title)}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="px-3 py-2.5">
                      <p className="text-xs font-semibold text-orange-700 uppercase">{option.id}</p>
                      <p className="text-sm font-medium text-slate-800 mt-0.5">{stripChatMarkdown(option.title)}</p>
                      {option.summary && (
                        <p className={cn(
                          "text-xs text-slate-600 mt-1",
                          imageSrc ? "line-clamp-2" : "line-clamp-3",
                        )}>
                          {stripChatMarkdown(option.summary)}
                        </p>
                      )}
                      {!imageSrc && option.content && option.content !== option.summary && (
                        <p className="text-xs text-slate-600 mt-2 line-clamp-4 whitespace-pre-wrap">
                          {stripChatMarkdown(option.content)}
                        </p>
                      )}
                    </div>
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
