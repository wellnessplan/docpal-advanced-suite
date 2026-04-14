import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Smile } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
              <Smile className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-heading text-xl font-bold text-foreground">DoctorsBuddy</span>
          </Link>
          <Link to="/"><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-16 prose prose-sm dark:prose-invert">
        <h1>Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: April 14, 2026</p>

        <h2>1. Acceptance of Terms</h2>
        <p>By accessing or using DoctorsBuddy ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.</p>

        <h2>2. Description of Service</h2>
        <p>DoctorsBuddy is a cloud-based clinic management platform that provides tools for patient management, appointment scheduling, billing, dental charting, and practice analytics.</p>

        <h2>3. User Accounts</h2>
        <p>You must provide accurate and complete registration information. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>

        <h2>4. Data Privacy & Security</h2>
        <p>We take the security of patient data seriously. All data is encrypted in transit and at rest. Each clinic's data is isolated and accessible only to authorized staff of that clinic. For more details, see our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.</p>

        <h2>5. Acceptable Use</h2>
        <p>You agree not to: (a) use the Service for any unlawful purpose; (b) attempt to gain unauthorized access to any part of the Service; (c) interfere with or disrupt the Service; (d) share your account credentials with unauthorized parties.</p>

        <h2>6. Payment Terms</h2>
        <p>Paid plans are billed on a monthly or annual basis. All fees are non-refundable except as required by law. We reserve the right to modify pricing with 30 days' notice.</p>

        <h2>7. Data Ownership</h2>
        <p>You retain all rights to your clinic and patient data. We do not sell, share, or use your data for any purpose other than providing the Service.</p>

        <h2>8. Service Availability</h2>
        <p>We strive for 99.9% uptime but do not guarantee uninterrupted access. We may perform scheduled maintenance with advance notice.</p>

        <h2>9. Limitation of Liability</h2>
        <p>DoctorsBuddy shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service.</p>

        <h2>10. Termination</h2>
        <p>Either party may terminate the agreement at any time. Upon termination, you may export your data within 30 days, after which it will be permanently deleted.</p>

        <h2>11. Changes to Terms</h2>
        <p>We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the modified Terms.</p>

        <h2>12. Contact</h2>
        <p>For questions about these Terms, contact us at <a href="mailto:legal@doctorsbuddy.com" className="text-primary hover:underline">legal@doctorsbuddy.com</a>.</p>
      </div>
    </div>
  );
}
