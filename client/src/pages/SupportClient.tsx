import * as React from "react";
import { MessageCircle, MessageCircleOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppLanguage, i18n } from "@/lib/i18n";
import { crispPush, initCrispWebsite, CRISP_SCRIPT_ID } from "@/lib/crisp-client";

const supportButtonLabels = {
  open: { en: "Open support", fr: "Ouvrir le support" },
  close: { en: "Close support", fr: "Fermer le support" },
} as const;

export default function SupportClient() {
  const language = useAppLanguage();
  const [supportOpen, setSupportOpen] = React.useState(false);

  React.useEffect(() => {
    void initCrispWebsite();

    const onOpened = () => setSupportOpen(true);
    const onClosed = () => setSupportOpen(false);

    crispPush(["do", "chat:hide"]);
    crispPush(["on", "chat:opened", onOpened]);
    crispPush(["on", "chat:closed", onClosed]);

    return () => {
      crispPush(["off", "chat:opened"]);
      crispPush(["off", "chat:closed"]);
      crispPush(["do", "chat:hide"]);
      setSupportOpen(false);
    };
  }, []);

  function toggleSupport() {
    if (!document.getElementById(CRISP_SCRIPT_ID)) {
      void initCrispWebsite();
    }
    if (supportOpen) {
      crispPush(["do", "chat:close"]);
    } else {
      crispPush(["do", "chat:show"]);
      crispPush(["do", "chat:open"]);
    }
  }

  const label =
    supportOpen ? supportButtonLabels.close : supportButtonLabels.open;

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.2),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.94)_0%,rgba(20,31,39,0.9)_52%,rgba(185,204,209,0.3)_100%)] p-10 text-center text-zinc-50 shadow-[0_28px_90px_-55px_rgba(0,0,0,0.95)] backdrop-blur">
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        <Button
          type="button"
          aria-expanded={supportOpen}
          aria-pressed={supportOpen}
          aria-label={i18n(language, label)}
          onClick={toggleSupport}
          className="group relative h-12 overflow-hidden rounded-full border border-white/20 bg-white/10 px-6 font-display text-sm font-semibold tracking-wide text-white shadow-[0_18px_55px_-28px_rgba(255,255,255,0.55)] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/15 hover:shadow-[0_24px_70px_-30px_rgba(214,228,255,0.75)]"
        >
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          <span className="relative flex items-center gap-2 bg-gradient-to-r from-white via-zinc-100 to-zinc-300 bg-clip-text text-transparent">
            {supportOpen ? (
              <MessageCircleOff className="h-4 w-4 text-zinc-100 transition-transform duration-300 group-hover:scale-110" />
            ) : (
              <MessageCircle className="h-4 w-4 text-zinc-100 transition-transform duration-300 group-hover:scale-110" />
            )}
            {i18n(language, label)}
          </span>
        </Button>
      </div>
    </div>
  );
}
