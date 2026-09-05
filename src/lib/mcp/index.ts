import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listPatients from "./tools/list-patients";
import getPatient from "./tools/get-patient";
import listAppointments from "./tools/list-appointments";
import bookAppointment from "./tools/book-appointment";
import listInvoices from "./tools/list-invoices";
import clinicSnapshot from "./tools/clinic-snapshot";
import checkAvailability from "./tools/check-availability";

// Import-safe: Vite inlines this literal at build time, so no runtime env read.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "doctorsbuddy-mcp",
  title: "DoctorsBuddy",
  version: "0.1.0",
  instructions:
    "Tools for DoctorsBuddy, a dental clinic management app. All tools act as the signed-in clinic user and only ever return that clinic's data. Use `clinic_snapshot` for today's overview, `list_patients` / `get_patient` to look up patient records, `list_appointments` to read the schedule, `check_availability` to find free bookable slots on a date, `book_appointment` to add a visit for an existing patient, and `list_invoices` for billing and outstanding balances.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [clinicSnapshot, listPatients, getPatient, listAppointments, checkAvailability, bookAppointment, listInvoices],
});
