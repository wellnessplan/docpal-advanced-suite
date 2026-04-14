
-- Sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1;

-- Function to auto-generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-' || LPAD(nextval('invoice_number_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on invoices
CREATE TRIGGER trg_generate_invoice_number
BEFORE INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.generate_invoice_number();

-- Auto-populate consultation_logs when appointment status changes
CREATE OR REPLACE FUNCTION public.auto_create_consultation_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When appointment is checked in, create a consultation log
  IF NEW.status = 'checked_in' AND (OLD.status IS DISTINCT FROM 'checked_in') THEN
    INSERT INTO public.consultation_logs (clinic_id, doctor_id, patient_id, appointment_id, checkin_at)
    VALUES (
      NEW.clinic_id,
      COALESCE(NEW.doctor_id, NEW.provider_id, '00000000-0000-0000-0000-000000000000'),
      NEW.patient_id,
      NEW.id,
      now()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- When in_progress, update consultation_start
  IF NEW.status = 'in_progress' AND (OLD.status IS DISTINCT FROM 'in_progress') THEN
    UPDATE public.consultation_logs
    SET consultation_start = now()
    WHERE appointment_id = NEW.id AND consultation_end IS NULL;
  END IF;

  -- When completed, update consultation_end
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    UPDATE public.consultation_logs
    SET consultation_end = now()
    WHERE appointment_id = NEW.id AND consultation_end IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_consultation_log
AFTER UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_consultation_log();
