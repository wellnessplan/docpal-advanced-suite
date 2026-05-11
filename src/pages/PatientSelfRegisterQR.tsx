import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stethoscope } from "lucide-react";

const QRCode = lazy(async () => {
  const m = await import("qrcode.react");
  return { default: m.QRCodeSVG as unknown as React.ComponentType<{ value: string; size?: number }> };
});

export default function PatientSelfRegisterQR() {
  const [clinicId, setClinicId] = useState("");
  const url = clinicId ? `${window.location.origin}/register?clinic=${clinicId}` : "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-teal-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" /> Generate Patient Registration QR
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Clinic ID</Label>
            <Input value={clinicId} onChange={(e) => setClinicId(e.target.value)} placeholder="Enter your clinic ID" />
          </div>
          {url && (
            <div className="flex flex-col items-center gap-4 p-4 bg-card rounded-xl border">
              <Suspense fallback={<div className="h-[200px] w-[200px] animate-pulse rounded bg-muted" />}>
                <QRCode value={url} size={200} />
              </Suspense>
              <p className="text-xs text-muted-foreground text-center break-all">{url}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
