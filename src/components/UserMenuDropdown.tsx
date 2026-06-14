import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Settings as SettingsIcon, Sun, Moon, LogOut, Shield, Stethoscope, Crown } from "lucide-react";
import { useSuperAdmin } from "@/hooks/useSubscription";

export default function UserMenuDropdown() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { mode, toggleMode } = useTheme();
  const { data: isSuperAdmin } = useSuperAdmin();
  const initials = (profile?.full_name || "U").charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Account menu"
          className="flex items-center gap-2 rounded-full pl-2 pr-1 py-1 hover:bg-muted/60 active:scale-95 transition-all"
        >
          <span className="text-xs md:text-sm text-muted-foreground hidden sm:block max-w-[120px] truncate">
            {profile?.full_name || "User"}
          </span>
          <span
            className="h-7 w-7 md:h-8 md:w-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground ring-2 ring-primary/20"
          >
            {initials}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-0.5">
            <p className="text-sm font-semibold leading-none">{profile?.full_name || "User"}</p>
            <p className="text-xs leading-none text-muted-foreground capitalize">
              {profile?.role || "Staff"}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => navigate("/dr-dashboard")}>
          <Stethoscope className="mr-2 h-4 w-4" />
          <span>Doctor Dashboard</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/settings?tab=clinic")}>
          <User className="mr-2 h-4 w-4" />
          <span>Profile / Clinic Info</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/settings")}>
          <SettingsIcon className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/settings?tab=subscription")}>
          <Crown className="mr-2 h-4 w-4 text-primary" />
          <span>Subscription &amp; Billing</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={toggleMode}>
          {mode === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
          <span>Switch to {mode === "dark" ? "Light" : "Dark"} mode</span>
        </DropdownMenuItem>

        {isSuperAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/super-admin")}>
              <Shield className="mr-2 h-4 w-4 text-amber-500" />
              <span>Super Admin</span>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
