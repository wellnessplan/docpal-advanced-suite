-- Education videos: curated (clinic_id null = global library) + clinic uploads
CREATE TABLE public.education_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  language text NOT NULL DEFAULT 'en',
  source_type text NOT NULL DEFAULT 'youtube' CHECK (source_type IN ('youtube','vimeo','upload','url')),
  source_url text NOT NULL,
  thumbnail_url text,
  duration_sec integer,
  tags text[] DEFAULT '{}',
  is_global boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.education_videos(clinic_id, category);
CREATE INDEX ON public.education_videos(is_global) WHERE is_global = true;
ALTER TABLE public.education_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View global + own clinic videos" ON public.education_videos FOR SELECT
  USING (is_global = true OR clinic_id = public.get_user_clinic_id());
CREATE POLICY "Insert own clinic videos" ON public.education_videos FOR INSERT
  WITH CHECK (clinic_id = public.get_user_clinic_id() AND is_global = false);
CREATE POLICY "Update own clinic videos" ON public.education_videos FOR UPDATE
  USING (clinic_id = public.get_user_clinic_id() AND is_global = false);
CREATE POLICY "Delete own clinic videos" ON public.education_videos FOR DELETE
  USING (clinic_id = public.get_user_clinic_id() AND is_global = false);

-- Display screens (TVs / waiting room / chair-side)
CREATE TABLE public.display_screens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  zone text NOT NULL DEFAULT 'waiting_room' CHECK (zone IN ('waiting_room','chair_side','reception','other')),
  pair_code text NOT NULL UNIQUE,
  is_paired boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz,
  current_video_id uuid REFERENCES public.education_videos(id) ON DELETE SET NULL,
  current_playlist_id uuid,
  is_playing boolean NOT NULL DEFAULT false,
  volume integer NOT NULL DEFAULT 50 CHECK (volume BETWEEN 0 AND 100),
  show_lower_third boolean NOT NULL DEFAULT true,
  show_queue boolean NOT NULL DEFAULT true,
  command jsonb,
  command_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.display_screens(clinic_id);
CREATE INDEX ON public.display_screens(pair_code);
ALTER TABLE public.display_screens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic staff manage screens" ON public.display_screens FOR ALL
  USING (clinic_id = public.get_user_clinic_id())
  WITH CHECK (clinic_id = public.get_user_clinic_id());
-- Public read by pair code (display devices are anonymous browsers)
CREATE POLICY "Public read by pair code" ON public.display_screens FOR SELECT
  USING (true);
-- Allow display device to update last_seen
CREATE POLICY "Public heartbeat update" ON public.display_screens FOR UPDATE
  USING (true) WITH CHECK (true);

-- Playlists
CREATE TABLE public.display_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  zone text DEFAULT 'waiting_room',
  shuffle boolean DEFAULT false,
  loop boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.display_playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic playlists" ON public.display_playlists FOR ALL
  USING (clinic_id = public.get_user_clinic_id())
  WITH CHECK (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Public read playlists" ON public.display_playlists FOR SELECT USING (true);

CREATE TABLE public.display_playlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.display_playlists(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES public.education_videos(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.display_playlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Playlist items via clinic" ON public.display_playlist_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.display_playlists p WHERE p.id = playlist_id AND p.clinic_id = public.get_user_clinic_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.display_playlists p WHERE p.id = playlist_id AND p.clinic_id = public.get_user_clinic_id()));
CREATE POLICY "Public read playlist items" ON public.display_playlist_items FOR SELECT USING (true);

-- Lower-third broadcast branding (per clinic)
CREATE TABLE public.display_branding (
  clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  logo_url text,
  clinic_name text,
  tagline text,
  phone text,
  ticker_messages text[] DEFAULT '{}',
  show_doctor_on_duty boolean DEFAULT true,
  show_now_serving boolean DEFAULT true,
  show_queue_panel boolean DEFAULT true,
  primary_color text DEFAULT '#5BADE6',
  text_color text DEFAULT '#FFFFFF',
  ticker_speed_sec integer DEFAULT 5,
  doctor_on_duty text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.display_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic manages branding" ON public.display_branding FOR ALL
  USING (clinic_id = public.get_user_clinic_id())
  WITH CHECK (clinic_id = public.get_user_clinic_id());
CREATE POLICY "Public read branding" ON public.display_branding FOR SELECT USING (true);

-- Storage bucket for clinic uploaded videos
INSERT INTO storage.buckets (id, name, public) VALUES ('education-videos', 'education-videos', true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('clinic-logos', 'clinic-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Clinic staff upload videos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'education-videos' AND (storage.foldername(name))[1] = public.get_user_clinic_id()::text);
CREATE POLICY "Public read education videos" ON storage.objects FOR SELECT
  USING (bucket_id = 'education-videos');
CREATE POLICY "Clinic staff delete videos" ON storage.objects FOR DELETE
  USING (bucket_id = 'education-videos' AND (storage.foldername(name))[1] = public.get_user_clinic_id()::text);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.display_screens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.display_branding;

-- Updated_at triggers
CREATE TRIGGER tg_education_videos_updated BEFORE UPDATE ON public.education_videos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tg_display_screens_updated BEFORE UPDATE ON public.display_screens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tg_display_branding_updated BEFORE UPDATE ON public.display_branding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed curated global library (dental education classics on YouTube)
INSERT INTO public.education_videos (clinic_id, title, description, category, source_type, source_url, thumbnail_url, is_global, duration_sec) VALUES
(NULL, 'What is a Root Canal Treatment?', 'Step-by-step animation explaining endodontic therapy', 'endodontics', 'youtube', 'https://www.youtube.com/watch?v=e9Cv1AEdNL8', 'https://img.youtube.com/vi/e9Cv1AEdNL8/hqdefault.jpg', true, 180),
(NULL, 'Dental Implants Procedure Explained', 'Full implant placement and healing process', 'implants', 'youtube', 'https://www.youtube.com/watch?v=il5tdyB55fA', 'https://img.youtube.com/vi/il5tdyB55fA/hqdefault.jpg', true, 240),
(NULL, 'Scaling and Polishing - Why You Need It', 'Importance of professional dental cleaning', 'preventive', 'youtube', 'https://www.youtube.com/watch?v=0IDGoSYC6tM', 'https://img.youtube.com/vi/0IDGoSYC6tM/hqdefault.jpg', true, 150),
(NULL, 'How Braces Straighten Teeth', 'Orthodontic treatment animation', 'orthodontics', 'youtube', 'https://www.youtube.com/watch?v=fSFEMITYNQI', 'https://img.youtube.com/vi/fSFEMITYNQI/hqdefault.jpg', true, 200),
(NULL, 'Tooth Extraction Procedure', 'What to expect during and after extraction', 'oral_surgery', 'youtube', 'https://www.youtube.com/watch?v=zWmxGcK0GgM', 'https://img.youtube.com/vi/zWmxGcK0GgM/hqdefault.jpg', true, 180),
(NULL, 'Composite Filling Procedure', 'Modern tooth-colored fillings explained', 'restorative', 'youtube', 'https://www.youtube.com/watch?v=jjQ-rZhBgT4', 'https://img.youtube.com/vi/jjQ-rZhBgT4/hqdefault.jpg', true, 160),
(NULL, 'Proper Brushing Technique', 'Bass technique for daily oral hygiene', 'preventive', 'youtube', 'https://www.youtube.com/watch?v=wHUbYE-2C0M', 'https://img.youtube.com/vi/wHUbYE-2C0M/hqdefault.jpg', true, 120),
(NULL, 'How to Floss Properly', 'Step-by-step flossing demonstration', 'preventive', 'youtube', 'https://www.youtube.com/watch?v=7lY0qWByvNo', 'https://img.youtube.com/vi/7lY0qWByvNo/hqdefault.jpg', true, 90),
(NULL, 'Dental Crown Procedure', 'Crown preparation and cementation', 'restorative', 'youtube', 'https://www.youtube.com/watch?v=l7ZBxTr5Xq8', 'https://img.youtube.com/vi/l7ZBxTr5Xq8/hqdefault.jpg', true, 200),
(NULL, 'Teeth Whitening Explained', 'In-office vs at-home whitening', 'cosmetic', 'youtube', 'https://www.youtube.com/watch?v=qPOlmOOY5Ts', 'https://img.youtube.com/vi/qPOlmOOY5Ts/hqdefault.jpg', true, 180),
(NULL, 'Wisdom Tooth Extraction', 'Third molar surgery explained', 'oral_surgery', 'youtube', 'https://www.youtube.com/watch?v=lhT0DkVAK9Y', 'https://img.youtube.com/vi/lhT0DkVAK9Y/hqdefault.jpg', true, 220),
(NULL, 'Gum Disease (Periodontitis)', 'Causes, stages, and treatment of gum disease', 'periodontics', 'youtube', 'https://www.youtube.com/watch?v=6Hi384pOHA8', 'https://img.youtube.com/vi/6Hi384pOHA8/hqdefault.jpg', true, 200);