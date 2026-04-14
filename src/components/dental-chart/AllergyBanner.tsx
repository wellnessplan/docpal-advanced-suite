import { AlertTriangle } from "lucide-react";

interface AllergyBannerProps {
  allergies: string | null | undefined;
  medicalConditions?: string | null;
}

export default function AllergyBanner({ allergies, medicalConditions }: AllergyBannerProps) {
  const hasAllergies = allergies && allergies.trim().length > 0;
  const hasConditions = medicalConditions && medicalConditions.trim().length > 0;

  if (!hasAllergies && !hasConditions) return null;

  return (
    <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-3 flex items-start gap-3 animate-fade-in">
      <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
        <AlertTriangle className="h-4 w-4 text-destructive" />
      </div>
      <div className="flex-1 min-w-0">
        {hasAllergies && (
          <div>
            <span className="text-xs font-bold text-destructive uppercase tracking-wider">⚠ Allergies</span>
            <p className="text-sm font-medium text-foreground mt-0.5">{allergies}</p>
          </div>
        )}
        {hasConditions && (
          <div className={hasAllergies ? "mt-1.5" : ""}>
            <span className="text-xs font-bold text-warning uppercase tracking-wider">Medical Conditions</span>
            <p className="text-sm text-foreground mt-0.5">{medicalConditions}</p>
          </div>
        )}
      </div>
    </div>
  );
}
