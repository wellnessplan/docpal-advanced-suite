import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Calendar, CreditCard, Webhook, ExternalLink } from "lucide-react";

const integrations = [
  { name: "WhatsApp Business", description: "Send automated messages, reminders, and campaigns", icon: MessageCircle, status: "Configure", color: "bg-green-100 text-green-700" },
  { name: "Google Calendar", description: "Sync appointments with Google Calendar", icon: Calendar, status: "Coming Soon", color: "bg-blue-100 text-blue-700" },
  { name: "Payment Gateway", description: "Accept online payments via UPI, cards & net banking", icon: CreditCard, status: "Coming Soon", color: "bg-purple-100 text-purple-700" },
  { name: "Webhooks", description: "Connect with Zapier, n8n, and custom automations", icon: Webhook, status: "Configure", color: "bg-orange-100 text-orange-700" },
];

export default function Integrations() {
  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-bold">Integrations</h1>
          <p className="text-muted-foreground text-sm">Connect external services to extend your clinic's capabilities</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {integrations.map(int => (
            <Card key={int.name} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex items-start gap-4">
                <div className={`h-11 w-11 rounded-xl ${int.color} flex items-center justify-center shrink-0`}>
                  <int.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-sm">{int.name}</p>
                    <Badge variant="secondary" className="text-[10px]">{int.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{int.description}</p>
                  <Button size="sm" variant="outline" className="mt-3 gap-1.5 text-xs h-7">
                    <ExternalLink className="h-3 w-3" /> Set Up
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
