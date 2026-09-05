import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireClinic } from "../supabase";

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export default defineTool({
  name: "check_availability",
  title: "Check slot availability",
  description:
    "Return bookable appointment slots for the signed-in user's clinic on a given date. Uses the clinic's working hours, breaks and slot duration, subtracts already-booked appointments, and hides past slots based on the supplied timezone.",
  inputSchema: {
    date: z.string().describe("Date to check, YYYY-MM-DD (clinic-local date)."),
    timezone: z
      .string()
      .optional()
      .describe("IANA timezone, e.g. Asia/Kolkata. Used to hide past slots. Defaults to Asia/Kolkata."),
    slot_duration_minutes: z
      .number()
      .int()
      .optional()
      .describe("Override the clinic's configured slot duration for this check."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date, timezone, slot_duration_minutes }, ctx) => {
    const scope = await requireClinic(ctx);
    if ("error" in scope) return scope.error;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date?.trim() ?? "")) {
      return errorResult("date must be in YYYY-MM-DD format.");
    }
    const tz = timezone?.trim() || "Asia/Kolkata";
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
    } catch {
      return errorResult(`Invalid timezone: ${tz}. Use an IANA name like Asia/Kolkata.`);
    }

    // Day of week for the clinic-local date (noon UTC avoids DST edge cases).
    const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();

    const [hoursRes, apptsRes] = await Promise.all([
      scope.supabase
        .from("clinic_working_hours")
        .select("is_closed, open_time, close_time, break_start, break_end, slot_duration_minutes")
        .eq("clinic_id", scope.clinicId)
        .eq("day_of_week", dayOfWeek)
        .maybeSingle(),
      scope.supabase
        .from("appointments")
        .select("appointment_time, duration_minutes, status")
        .eq("clinic_id", scope.clinicId)
        .eq("appointment_date", date)
        .neq("status", "cancelled"),
    ]);

    if (hoursRes.error) return errorResult(hoursRes.error.message);
    if (apptsRes.error) return errorResult(apptsRes.error.message);

    const hours = hoursRes.data;
    if (!hours || hours.is_closed || !hours.open_time || !hours.close_time) {
      return jsonResult({ date, timezone: tz, day_of_week: dayOfWeek, open: false, slots: [] });
    }

    const duration = slot_duration_minutes ?? hours.slot_duration_minutes ?? 30;
    const openMin = toMinutes(hours.open_time);
    const closeMin = toMinutes(hours.close_time);
    const breakStart = hours.break_start ? toMinutes(hours.break_start) : null;
    const breakEnd = hours.break_end ? toMinutes(hours.break_end) : null;

    const busy = (apptsRes.data ?? []).map((a) => {
      const start = toMinutes(a.appointment_time);
      return { start, end: start + (a.duration_minutes ?? duration) };
    });

    // Current time in the requested timezone, to hide past slots.
    const nowParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const part = (type: string) => nowParts.find((p) => p.type === type)?.value ?? "";
    const todayInTz = `${part("year")}-${part("month")}-${part("day")}`;
    const nowMin = Number(part("hour")) * 60 + Number(part("minute"));

    const slots: { start: string; end: string; available: boolean }[] = [];
    for (let t = openMin; t + duration <= closeMin; t += duration) {
      const end = t + duration;
      const inBreak = breakStart !== null && breakEnd !== null && t < breakEnd && end > breakStart;
      const overlaps = busy.some((b) => t < b.end && end > b.start);
      const isPast = date < todayInTz || (date === todayInTz && t <= nowMin);
      slots.push({ start: toHHMM(t), end: toHHMM(end), available: !inBreak && !overlaps && !isPast });
    }

    return jsonResult({
      date,
      timezone: tz,
      day_of_week: dayOfWeek,
      open: true,
      open_time: hours.open_time,
      close_time: hours.close_time,
      slot_duration_minutes: duration,
      total_slots: slots.length,
      available_slots: slots.filter((s) => s.available),
      slots,
    });
  },
});
