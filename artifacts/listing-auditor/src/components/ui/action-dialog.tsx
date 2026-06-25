import { useState, useRef, useCallback } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type Stage = "confirm" | "loading" | "success";

export interface ActionDialogConfig {
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmVariant?: "default" | "destructive";
  successTitle?: string;
  successDescription?: string;
  inputField?: {
    label: string;
    placeholder?: string;
    defaultValue?: string;
  };
}

export function useActionDialog() {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("confirm");
  const [config, setConfig] = useState<ActionDialogConfig>({ title: "" });
  const [inputValue, setInputValue] = useState("");
  const pendingFn = useRef<((input: string) => Promise<void>) | null>(null);

  const trigger = useCallback(
    (fn: (input: string) => Promise<void>, cfg: ActionDialogConfig) => {
      pendingFn.current = fn;
      setConfig(cfg);
      setInputValue(cfg.inputField?.defaultValue ?? "");
      setStage("confirm");
      setOpen(true);
    },
    []
  );

  async function handleConfirm() {
    setStage("loading");
    try {
      await pendingFn.current?.(inputValue);
      setStage("success");
    } catch {
      setOpen(false);
    }
  }

  const dialog = (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(v) => {
        if (!v && stage !== "loading") setOpen(false);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%]",
            "rounded-2xl border bg-background p-6 shadow-2xl duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
          onInteractOutside={(e) => {
            if (stage === "loading") e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (stage === "loading") e.preventDefault();
          }}
        >
          {stage === "confirm" && (
            <>
              <DialogPrimitive.Title className="text-base font-semibold leading-tight">
                {config.title}
              </DialogPrimitive.Title>
              {config.description && (
                <DialogPrimitive.Description className="mt-1.5 text-sm text-muted-foreground">
                  {config.description}
                </DialogPrimitive.Description>
              )}
              {config.inputField && (
                <div className="mt-3">
                  <label className="text-sm font-medium block mb-1.5">
                    {config.inputField.label}
                  </label>
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={config.inputField.placeholder}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && inputValue.trim()) void handleConfirm();
                    }}
                  />
                </div>
              )}
              <div className="mt-5 flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant={config.confirmVariant === "destructive" ? "destructive" : "default"}
                  onClick={() => void handleConfirm()}
                  disabled={!!config.inputField && !inputValue.trim()}
                >
                  {config.confirmLabel ?? "Confirm"}
                </Button>
              </div>
            </>
          )}

          {stage === "loading" && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground font-medium">Please wait…</p>
            </div>
          )}

          {stage === "success" && (
            <>
              <div className="flex flex-col items-center justify-center py-4 gap-3">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-base">{config.successTitle ?? "Done!"}</p>
                  {config.successDescription && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {config.successDescription}
                    </p>
                  )}
                </div>
              </div>
              <Button className="w-full mt-2" onClick={() => {
                setOpen(false);
                toast({
                  title: config.successTitle ?? "Done!",
                  description: config.successDescription,
                });
              }}>
                OK
              </Button>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );

  return { open, stage, trigger, dialog };
}
