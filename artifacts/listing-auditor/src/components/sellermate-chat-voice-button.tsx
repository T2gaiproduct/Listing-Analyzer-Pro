import { Mic, MicOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSellermateSpeechDictation } from "@/hooks/use-sellermate-speech-dictation";
import { cn } from "@/lib/utils";

type SellermateChatVoiceButtonProps = {
  disabled?: boolean;
  disabledReason?: string;
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
};

export function SellermateChatVoiceButton({
  disabled,
  disabledReason,
  onTranscript,
  onError,
}: SellermateChatVoiceButtonProps) {
  const { isSupported, isListening, toggleListening } = useSellermateSpeechDictation({
    onFinalTranscript: onTranscript,
    onError,
  });

  const blocked = disabled || !isSupported;
  const tooltip = !isSupported
    ? "Voice input works in Chrome and Edge on desktop."
    : disabledReason ?? (isListening ? "Stop listening" : "Dictate with your microphone");

  const voiceButton = (
    <button
      type="button"
      disabled={blocked}
      aria-label={isListening ? "Stop voice input" : "Start voice input"}
      aria-pressed={isListening}
      onClick={() => toggleListening()}
      className={cn(
        "w-8 h-8 rounded-lg border flex items-center justify-center transition-colors",
        isListening
          ? "border-orange-300 bg-orange-50 text-orange-600 animate-pulse"
          : "border-slate-200 text-slate-500 hover:bg-slate-50",
        "disabled:opacity-40 disabled:pointer-events-none",
      )}
    >
      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{voiceButton}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
