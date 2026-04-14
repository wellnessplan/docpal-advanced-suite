import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Smile } from "lucide-react";

export default function PrivacyPolicy() {
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
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: April 14, 2026</p>

        <h2>1. Information We Collect</h2>
        <p>We collect information you provide when registering: name, email, clinic details. Patient data entered into the system is stored securely and belongs to your clinic.</p>

        <h2>2. How We Use Your Information</h2>
        <p>We use your information solely to: (a) provide and maintain the Service; (b) send important service notifications; (c) improve the Service. We never sell your data to third parties.</p>

        <h2>3. Data Storage & Security</h2>
        <p>All data is stored on secure, encrypted servers. We implement industry-standard security measures including encryption at rest and in transit, row-level security for data isolation, and regular security audits.</p>

        <h2>4. Patient Data</h2>
        <p>Patient health records are treated with the highest level of confidentiality. Access is restricted to authorized clinic staff only. Each clinic's data is completely isolated from other clinics.</p>

        <h2>5. Data Retention</h2>
        <p>Your data is retained as long as your account is active. Upon account deletion, all data is permanently removed within 30 days. You can export your data at any time.</p>

        <h2>6. Cookies & Analytics</h2>
        <p>We use essential cookies to maintain your session. We may use anonymized analytics to improve the Service. You can opt out of non-essential cookies.</p>

        <h2>7. Third-Party Services</h2>
        <p>We may use third-party services (payment processors, email providers) that have their own privacy policies. We only share the minimum data necessary for these services to function.</p>

        <h2>8. Your Rights</h2>
        <p>You have the right to: (a) access your data; (b) correct inaccurate data; (c) delete your data; (d) export your data; (e) withdraw consent. Contact us to exercise these rights.</p>

        <h2>9. Children's Privacy</h2>
        <p>The Service is not directed at individuals under 18. Patient records for minors are managed by their parent/guardian through the clinic.</p>

        <h2>10. Changes to This Policy</h2>
        <p>We will notify you of material changes via email or in-app notification at least 30 days before they take effect.</p>

        <h2>11. Contact</h2>
        <p>For privacy inquiries, contact us at <a href="mailto:privacy@doctorsbuddy.com" className="text-primary hover:underline">privacy@doctorsbuddy.com</a>.</p>
      </div>
    </div>
  );
}
