import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tv } from "lucide-react";

export default function DisplayPair() {
  const { code: paramCode } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(paramCode || "");

  const handleGo = () => {
    if (code.trim().length === 6) {
      navigate(`/display/${code.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="text-center space-y-6 max-w-md">
        <Tv className="h-20 w-20 mx-auto text-primary" />
        <div>
          <h1 className="text-4xl font-bold">Clinic Display</h1>
          <p className="text-white/60 mt-2">Enter the 6-digit pair code shown in your dashboard</p>
        </div>
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="bg-white/10 border-white/20 text-white text-center text-2xl tracking-widest font-mono h-14"
            placeholder="ABC123"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleGo()}
          />
          <Button onClick={handleGo} disabled={code.length !== 6} size="lg" className="h-14 px-8">
            Connect
          </Button>
        </div>
        <p className="text-xs text-white/40">
          Tip: Use a Smart TV browser, Fire Stick, Chromecast with Google TV, or any laptop. After connecting, control everything from the dashboard.
        </p>
      </div>
    </div>
  );
}
