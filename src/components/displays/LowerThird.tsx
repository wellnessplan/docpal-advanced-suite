// Reusable lower-third overlay used by DisplayScreen (live TV) and DisplayManager (preview).
// 6 styles — broadcast | minimal | news | cinema | spotlight | sidebar.

import { useEffect, useState } from "react";

export type LowerThirdStyle = "broadcast" | "minimal" | "news" | "cinema" | "spotlight" | "sidebar" | "image";

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
  // Optional spotlight/sidebar extras
  highlight_title?: string | null;     // e.g. "Estimated Wait Time"
  highlight_value?: string | null;     // e.g. "15 - 20"
  highlight_unit?: string | null;      // e.g. "MINUTES"
  cta_text?: string | null;            // e.g. "Scan Here! Make an appointment"
  qr_url?: string | null;              // image URL for QR code
  banner_image_url?: string | null;    // full-width image banner overlay
  // Banner positioning (for variant="image")
  banner_x?: number | null;            // 0..100 horizontal anchor (%)
  banner_y?: number | null;            // 0..100 vertical anchor (%)
  banner_scale?: number | null;        // 0.1..3 scale multiplier
  banner_fit?: "contain" | "cover" | "stretch" | null;
  banner_opacity?: number | null;      // 0..1 — image-only opacity
}

interface Props {
  branding: LowerThirdBranding | null | undefined;
  style?: LowerThirdStyle;          // override the saved style (used by preview)
  className?: string;
  opacity?: number;                 // 0..1 — overall layer transparency
}

export const LOWER_THIRD_STYLES: { value: LowerThirdStyle; label: string; description: string }[] = [
  { value: "broadcast", label: "Broadcast", description: "Full TV-style with logo, ticker bar & doctor" },
  { value: "minimal",   label: "Minimal",   description: "Clean single bar — logo + name only" },
  { value: "news",      label: "News Ticker", description: "Bold name block + scrolling ticker" },
  { value: "cinema",    label: "Cinema",    description: "Subtle bottom-left credit, ideal for explanations" },
  { value: "spotlight", label: "Spotlight", description: "Right-side highlight tile + bottom info bar with QR" },
  { value: "sidebar",   label: "Sidebar",   description: "Right-rail info column + bottom-left logo" },
  { value: "image",     label: "Image Banner", description: "Custom uploaded banner image as the lower third" },
];

export default function LowerThird({ branding, style, className = "", opacity }: Props) {
  const variant: LowerThirdStyle = style || branding?.lower_third_style || "broadcast";
  const layerStyle = typeof opacity === "number" ? { opacity: Math.max(0, Math.min(1, opacity)) } : undefined;
  const primary = branding?.primary_color || "#5BADE6";
  const text = branding?.text_color || "#FFFFFF";
  const messages = (branding?.ticker_messages || []).filter(Boolean);
  const [tickerIdx, setTickerIdx] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const speed = (branding?.ticker_speed_sec || 5) * 1000;
    const t = setInterval(() => setTickerIdx((i) => (i + 1) % messages.length), speed);
    return () => clearInterval(t);
  }, [messages.length, branding?.ticker_speed_sec]);

  const currentTicker = messages[tickerIdx];
  const name = branding?.clinic_name || "Your Clinic";

  // Marquee ticker — actually scrolls a continuous string of all messages
  const marqueeText = messages.length ? messages.join("   •   ") + "   •   " : "";
  const marqueeDuration = Math.max(15, marqueeText.length * 0.25); // sec

  if (variant === "minimal") {
    return (
      <div className={`absolute bottom-0 left-0 right-0 ${className}`} style={layerStyle}>
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
      <div className={`absolute bottom-0 left-0 right-0 ${className}`} style={layerStyle}>
        <div className="flex items-stretch text-white">
          <div className="px-5 py-3 font-bold text-sm uppercase tracking-wider shrink-0 z-10" style={{ background: primary, color: text }}>
            {name}
          </div>
          <div className="flex-1 bg-black/85 backdrop-blur-md px-4 py-3 overflow-hidden relative">
            {marqueeText ? (
              <div className="whitespace-nowrap inline-block animate-lt-marquee text-sm font-medium"
                   style={{ animationDuration: `${marqueeDuration}s` }}>
                <span style={{ color: primary }} className="mr-2">▸</span>{marqueeText}
                <span style={{ color: primary }} className="mr-2">▸</span>{marqueeText}
              </div>
            ) : (
              <p className="text-sm opacity-70 truncate">{branding?.tagline || "Welcome to our clinic"}</p>
            )}
          </div>
          {branding?.phone && (
            <div className="px-4 py-3 bg-black/85 text-white text-sm font-mono shrink-0 border-l border-white/10 z-10">
              ☏ {branding.phone}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === "cinema") {
    return (
      <div className={`absolute bottom-6 left-6 ${className}`} style={layerStyle}>
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

  if (variant === "spotlight") {
    // Right-side highlight tile + bottom info bar (matches "Wait Time + QR" reference)
    return (
      <div className={`absolute inset-0 pointer-events-none ${className}`} style={layerStyle}>
        {/* Right side highlight panel */}
        <div className="absolute top-6 right-6 w-56 rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-4 py-3 text-white text-center" style={{ background: primary }}>
            <p className="text-[11px] uppercase tracking-wide opacity-90">{branding?.highlight_title || "Estimated Wait Time"}</p>
            <p className="text-3xl font-extrabold mt-1">{branding?.highlight_value || "15 - 20"}</p>
            <p className="text-[10px] uppercase tracking-widest opacity-80">{branding?.highlight_unit || "minutes"}</p>
          </div>
          <div className="px-4 py-4 text-white text-center" style={{ background: `${primary}CC`, filter: "hue-rotate(20deg)" }}>
            <p className="text-xs leading-snug opacity-95">{branding?.tagline || "Stay healthy. Visit us today."}</p>
          </div>
        </div>

        {/* Bottom info bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md flex items-center gap-4 px-6 py-3">
          {branding?.logo_url ? (
            <img src={branding.logo_url} alt="" className="h-10 w-10 rounded object-contain" />
          ) : (
            <div className="h-10 w-10 rounded grid place-items-center text-white font-bold" style={{ background: primary }}>
              {name.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold leading-tight" style={{ color: primary }}>{name}</p>
            {marqueeText ? (
              <div className="overflow-hidden">
                <div className="whitespace-nowrap inline-block animate-lt-marquee text-xs text-slate-700"
                     style={{ animationDuration: `${marqueeDuration}s` }}>
                  {marqueeText}{marqueeText}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600 truncate">{branding?.tagline}</p>
            )}
          </div>
          {branding?.qr_url && (
            <div className="text-center">
              <img src={branding.qr_url} alt="QR" className="h-12 w-12 object-contain" />
              <p className="text-[9px] font-semibold mt-0.5" style={{ color: primary }}>Scan</p>
            </div>
          )}
          {branding?.phone && (
            <div className="text-right border-l pl-3">
              <p className="text-[9px] uppercase text-slate-500">Call</p>
              <p className="text-sm font-bold font-mono" style={{ color: primary }}>{branding.phone}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === "sidebar") {
    // Right-rail stacked info cards + bottom-left logo (matches "weather/news cards" reference)
    return (
      <div className={`absolute inset-0 pointer-events-none ${className}`} style={layerStyle}>
        {/* Right rail */}
        <div className="absolute top-0 right-0 bottom-0 w-[28%] min-w-[200px] max-w-[320px] flex flex-col gap-1.5 p-2 bg-black/10 backdrop-blur-sm">
          {/* Header card */}
          <div className="rounded-lg px-4 py-3 text-white" style={{ background: primary }}>
            <p className="text-[10px] uppercase tracking-wider opacity-80">{branding?.highlight_title || "Welcome"}</p>
            <p className="text-xl font-bold leading-tight">{name}</p>
            {branding?.tagline && <p className="text-[11px] opacity-90 mt-0.5 leading-snug">{branding.tagline}</p>}
          </div>
          {/* Doctor card */}
          {branding?.show_doctor_on_duty && branding?.doctor_on_duty && (
            <div className="rounded-lg px-4 py-2.5 bg-white/95 text-slate-800">
              <p className="text-[10px] uppercase tracking-wide opacity-60">On Duty</p>
              <p className="text-sm font-semibold">{branding.doctor_on_duty}</p>
            </div>
          )}
          {/* Highlight value card */}
          {branding?.highlight_value && (
            <div className="rounded-lg px-4 py-2.5 bg-white/95 text-slate-800">
              <p className="text-[10px] uppercase tracking-wide opacity-60">{branding.highlight_title || "Now"}</p>
              <p className="text-lg font-bold" style={{ color: primary }}>{branding.highlight_value} <span className="text-[10px] uppercase opacity-70">{branding.highlight_unit}</span></p>
            </div>
          )}
          {/* Ticker messages — each on its own card */}
          {messages.slice(0, 4).map((m, i) => (
            <div key={i} className="rounded-lg px-4 py-2 bg-white/85 text-slate-800 text-xs leading-snug">
              <span className="font-semibold mr-1" style={{ color: primary }}>•</span>{m}
            </div>
          ))}
          {branding?.phone && (
            <div className="mt-auto rounded-lg px-4 py-2.5 text-white text-center" style={{ background: primary }}>
              <p className="text-[10px] uppercase opacity-80">Call</p>
              <p className="text-base font-bold font-mono">{branding.phone}</p>
            </div>
          )}
        </div>

        {/* Bottom-left logo block */}
        <div className="absolute bottom-6 left-6 flex items-center gap-3 text-white drop-shadow-lg">
          {branding?.logo_url && <img src={branding.logo_url} alt="" className="h-12 object-contain" />}
          <p className="text-2xl font-bold uppercase tracking-wider">{name}</p>
        </div>
      </div>
    );
  }

  if (variant === "image" && branding?.banner_image_url) {
    const bx = typeof branding.banner_x === "number" ? branding.banner_x : 50;
    const by = typeof branding.banner_y === "number" ? branding.banner_y : 100;
    const bs = typeof branding.banner_scale === "number" ? branding.banner_scale : 1;
    const bfit = branding.banner_fit || "contain";
    const bop = typeof branding.banner_opacity === "number" ? branding.banner_opacity : 1;
    // Combine layer opacity * banner-specific opacity
    const combinedOp = (typeof opacity === "number" ? opacity : 1) * bop;
    const imgClass = bfit === "cover"
      ? "w-full h-full object-cover"
      : bfit === "stretch"
        ? "w-full h-full"
        : "max-w-full max-h-full object-contain";
    return (
      <div className={`absolute inset-0 pointer-events-none ${className}`} style={{ opacity: Math.max(0, Math.min(1, combinedOp)) }}>
        <div
          className="absolute"
          style={{
            left: `${bx}%`,
            top: `${by}%`,
            transform: `translate(-50%, -100%) scale(${bs})`,
            transformOrigin: "center bottom",
            width: bfit === "stretch" ? "100%" : "auto",
            maxWidth: "100%",
          }}
        >
          <img src={branding.banner_image_url} alt="" className={imgClass} style={{ display: "block" }} />
        </div>
      </div>
    );
  }

  // broadcast (default) — full style with proper marquee ticker
  return (
    <div className={`absolute bottom-0 left-0 right-0 ${className}`} style={layerStyle}>
      {marqueeText && (
        <div className="overflow-hidden text-sm font-medium" style={{ background: `${primary}DD`, color: text }}>
          <div className="whitespace-nowrap inline-block animate-lt-marquee py-2"
               style={{ animationDuration: `${marqueeDuration}s` }}>
            <span className="opacity-80 mx-3">●</span>{marqueeText}
            <span className="opacity-80 mx-3">●</span>{marqueeText}
          </div>
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
