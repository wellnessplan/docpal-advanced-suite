CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_clinic_op_number_unique
ON public.patients (clinic_id, op_number)
WHERE op_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_op_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_number integer;
BEGIN
  IF NEW.op_number IS NULL THEN
    IF NEW.clinic_id IS NULL THEN
      RAISE EXCEPTION 'clinic_id is required to generate UHID';
    END IF;

    PERFORM 1
    FROM public.clinics
    WHERE id = NEW.clinic_id
    FOR UPDATE;

    SELECT COALESCE(
      MAX(
        CASE
          WHEN op_number ~ '^OP-[0-9]+$' THEN substring(op_number from 4)::integer
          ELSE NULL
        END
      ),
      0
    ) + 1
    INTO next_number
    FROM public.patients
    WHERE clinic_id = NEW.clinic_id;

    NEW.op_number := 'OP-' || LPAD(next_number::text, 5, '0');
  END IF;

  RETURN NEW;
END;
$function$;