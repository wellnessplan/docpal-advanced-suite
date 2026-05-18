CREATE UNIQUE INDEX IF NOT EXISTS appointments_no_double_book
ON public.appointments (clinic_id, provider_id, appointment_date, appointment_time)
WHERE status NOT IN ('cancelled', 'no_show') AND provider_id IS NOT NULL;