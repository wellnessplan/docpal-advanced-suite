# Architecture Rules

- Keep platform-wide settings limited to super administrators, and create clinics through the authenticated `create_clinic_for_user` function rather than direct client inserts; this protects global configuration and binds new clinics to their owner.
- Serve public registration options and pair-code display data through narrowly scoped security-definer read functions; this preserves public workflows without exposing whole settings or screen tables.