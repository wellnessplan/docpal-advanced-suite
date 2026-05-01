// Reusable lower-third overlay used by DisplayScreen (live TV) and DisplayManager (preview).
// 4 styles — broadcast | minimal | news | cinema.

import { useEffect, useState } from "react";

export type LowerThirdStyle = "broadcast" | "minimal" | "news" | "cinema";

export interface LowerThirdBranding {
  logo_url?: string | null;
  clinic_name?: string | null;
  tagline?: string | null;
  phone?: string | null;
  ticker_messages?: string[] | null;
  ticker_speed_sec?: number | null;
  doctor_on_duty?: string | null;
  show_doctor_on_duty?: boolean;
  primary_color?: string | null;
  text_color?: string | null;
  lower_third_style?: LowerThirdStyle;
}

interface Props {
  branding: LowerThirdBranding | null | undefined;
  style?: LowerThirdStyle;          // override the saved style (used by preview)
  className?: string;
}

export const LOWER_THIRD_STYLES: { value: LowerThirdStyle; label: string; description: string }[] = [
  { value: "broadcast", label: "Broadcast", description: "Full TV-style with logo, ticker bar & doctor" },
  { value: "minimal",   label: "Minimal",   description: "Clean single bar — logo + name only" },
  { value: "news",      label: "News Ticker", description: "Bold name block + scrolling ticker" },
  { value: "cinema",    label: "Cinema",    description: "Subtle bottom-left credit, ideal for explanations" },
];

export default function LowerThird({ branding, style, className = "" }: Props) {
  const variant: LowerThirdStyle = style || branding?.lower_third_style || "broadcast";
  const primary = branding?.primary_color || "#5BADE6";
  const text = branding?.text_color || "#FFFFFF";
  const messages = branding?.ticker_messages || [];
  const [tickerIdx, setTickerIdx] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const speed = (branding?.ticker_speed_sec || 5) * 1000;
    const t = setInterval(() => setTickerIdx((i) => (i + 1) % messages.length), speed);
    return () => clearInterval(t);
  }, [messages.length, branding?.ticker_speed_sec]);

  const currentTicker = messages[tickerIdx];
  const name = branding?.clinic_name || "Your Clinic";

  if (variant === "minimal") {
    return (
      <div className={`absolute bottom-0 left-0 right-0 ${className}`}>
        <div className="flex items-center gap-3 px-6 py-3 bg-black/70 backdrop-blur-md text-white">
          {branding?.logo_url && <img src={branding.logo_url} alt="" className="h-8 w-8 rounded object-contain bg-white/10 p-0.5" />}
          <p className="text-base font-semibold tracking-tight" style={{ color: primary }}>{name}</p>
          {branding?.tagline && <p className="text-xs opacity-70 truncate">— {branding.tagline}</p>}
          {branding?.phone && <p className="ml-auto text-xs font-mono opacity-80">{branding.phone}</p>}
        </div>
      </div>
    );
  }

  if (variant === "news") {
    return (
      <div className={`absolute bottom-0 left-0 right-0 ${className}`}>
        <div className="flex items-stretch text-white">
          <div className="px-5 py-3 font-bold text-sm uppercase tracking-wider shrink-0" style={{ background: primary, color: text }}>
            {name}
          </div>
          <div className="flex-1 bg-black/85 backdrop-blur-md px-4 py-3 overflow-hidden relative">
            {currentTicker ? (
              <p key={tickerIdx} className="text-sm font-medium animate-fade-in truncate">
                <span style={{ color: primary }} className="mr-2">▸</span>{currentTicker}
              </p>
            ) : (
              <p className="text-sm opacity-70 truncate">{branding?.tagline || "Welcome to our clinic"}</p>
            )}
          </div>
          {branding?.phone && (
            <div className="px-4 py-3 bg-black/85 text-white text-sm font-mono shrink-0 border-l border-white/10">
              ☏ {branding.phone}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === "cinema") {
    return (
      <div className={`absolute bottom-6 left-6 ${className}`}>
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-sm rounded-md px-4 py-2 text-white border-l-2" style={{ borderColor: primary }}>
          {branding?.logo_url && <img src={branding.logo_url} alt="" className="h-7 w-7 rounded object-contain" />}
          <div className="leading-tight">
            <p className="text-sm font-semibold">{name}</p>
            {branding?.tagline && <p className="text-[10px] opacity-70">{branding.tagline}</p>}
          </div>
        </div>
      </div>
    );
  }

  // broadcast (default) — full style
  return (
    <div className={`absolute bottom-0 left-0 right-0 ${className}`}>
      {currentTicker && (
        <div className="px-6 py-2 text-sm font-medium animate-fade-in" style={{ background: `${primary}DD`, color: text }}>
          <span className="opacity-80 mr-2">●</span>{currentTicker}
        </div>
      )}
      <div className="flex items-center gap-4 px-6 py-4 bg-gradient-to-t from-black/90 to-black/60 text-white">
        {branding?.logo_url && <img src={branding.logo_url} alt="" className="h-14 w-14 rounded-lg object-contain bg-white/10 p-1" />}
        <div className="flex-1 min-w-0">
          <p className="text-2xl font-bold leading-tight truncate" style={{ color: primary }}>{name}</p>
          {branding?.tagline && <p className="text-sm opacity-80 truncate">{branding.tagline}</p>}
        </div>
        {branding?.show_doctor_on_duty && branding?.doctor_on_duty && (
          <div className="text-right shrink-0 hidden sm:block border-r border-white/20 pr-4 mr-1">
            <p className="text-[10px] opacity-70 uppercase">On Duty</p>
            <p className="text-sm font-semibold">{branding.doctor_on_duty}</p>
          </div>
        )}
        {branding?.phone && (
          <div className="text-right shrink-0">
            <p className="text-xs opacity-70">Call us</p>
            <p className="text-xl font-bold font-mono">{branding.phone}</p>
          </div>
        )}
      </div>
    </div>
  );
}
