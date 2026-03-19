-- =============================================================================
-- Parlareo / Base44 → Supabase PostgreSQL Schema
-- Generated from codebase scan: Lesson, Teacher, Message, Review, Booking models
-- Run this in Supabase SQL Editor
-- =============================================================================

-- Enable UUID extension (usually already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. PROFILES (extends auth.users)
-- =============================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
  teacher_status TEXT CHECK (teacher_status IN ('pending_review', 'approved', 'rejected')),
  english_level_assessment_completed BOOLEAN DEFAULT FALSE,
  avatar TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-create profile + teacher_profiles or student_profiles on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_full_name TEXT;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');

  INSERT INTO public.profiles (id, email, full_name, role, teacher_status)
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    v_role,
    CASE WHEN v_role = 'teacher' THEN 'pending_review' ELSE NULL END
  );

  IF v_role = 'teacher' THEN
    INSERT INTO public.teacher_profiles (profile_id, verification_status, is_active)
    VALUES (NEW.id, 'pending', false);
  ELSIF v_role = 'student' THEN
    INSERT INTO public.student_profiles (profile_id)
    VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 2. TEACHER PROFILES (extends profiles for teachers)
-- =============================================================================
CREATE TABLE public.teacher_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  bio TEXT,
  nationality TEXT,
  years_experience INTEGER,
  lesson_types TEXT[] DEFAULT '{}',
  specializations TEXT[] DEFAULT '{}',
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified')),
  is_active BOOLEAN DEFAULT FALSE,
  lesson_price_25 DECIMAL(10,2) DEFAULT 21,
  lesson_price_50 DECIMAL(10,2) DEFAULT 35,
  profile_views INTEGER DEFAULT 0,
  total_completed_lessons INTEGER DEFAULT 0,
  total_lessons_taught INTEGER DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  offers_video BOOLEAN DEFAULT TRUE,
  offers_audio BOOLEAN DEFAULT TRUE,
  stripe_account_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 3. STUDENT PROFILES (extends profiles for students)
-- =============================================================================
CREATE TABLE public.student_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  english_level TEXT,
  job TEXT,
  interests TEXT[] DEFAULT '{}',
  learning_goals TEXT,
  test_score INTEGER,
  test_answers JSONB,
  lessons_remaining INTEGER DEFAULT 0,
  preferred_session_duration INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 4. TEACHER AVAILABILITY (Green slots on calendar)
-- =============================================================================
CREATE TABLE public.teacher_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_profile_id UUID NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sun, 6=Sat
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_recurring BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

CREATE INDEX idx_teacher_availability_teacher ON public.teacher_availability(teacher_profile_id);
CREATE INDEX idx_teacher_availability_day ON public.teacher_availability(day_of_week);

-- =============================================================================
-- 5. BLOCKED DATES (Teacher exceptions)
-- =============================================================================
CREATE TABLE public.blocked_dates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_profile_id UUID NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_profile_id, date)
);

-- =============================================================================
-- 6. BOOKINGS (links students and teachers)
-- =============================================================================
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  availability_slot_id UUID NOT NULL REFERENCES public.teacher_availability(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  session_duration INTEGER NOT NULL CHECK (session_duration IN (25, 50)),
  student_name TEXT,
  student_level TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'canceled', 'cancelled')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'held', 'unpaid', 'completed', 'refunded', 'charged_late_cancel')),
  notes TEXT,
  change_timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bookings_student ON public.bookings(student_id);
CREATE INDEX idx_bookings_teacher ON public.bookings(teacher_id);
CREATE INDEX idx_bookings_date ON public.bookings(date);
CREATE INDEX idx_bookings_status ON public.bookings(status);

-- =============================================================================
-- 7. CONVERSATIONS (chat grouping)
-- =============================================================================
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT different_participants CHECK (participant_1_id != participant_2_id),
  CONSTRAINT ordered_participants CHECK (participant_1_id < participant_2_id),
  CONSTRAINT unique_conversation_pair UNIQUE (participant_1_id, participant_2_id)
);

CREATE INDEX idx_conversations_p1 ON public.conversations(participant_1_id);
CREATE INDEX idx_conversations_p2 ON public.conversations(participant_2_id);

-- =============================================================================
-- 8. MESSAGES (chat messages)
-- =============================================================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_created ON public.messages(created_at);

-- =============================================================================
-- 9. TEACHER REVIEWS (optional, from TeacherReview entity)
-- =============================================================================
CREATE TABLE public.teacher_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_teacher_reviews_teacher ON public.teacher_reviews(teacher_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_reviews ENABLE ROW LEVEL SECURITY;

-- --- PROFILES ---
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Teachers and students can view teacher profiles (for browsing)
CREATE POLICY "Anyone authenticated can view teacher profiles"
  ON public.teacher_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Teachers can manage own teacher profile"
  ON public.teacher_profiles FOR ALL
  USING (
    profile_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (role = 'teacher' OR teacher_status IN ('pending_review', 'approved'))
    )
  )
  WITH CHECK (
    profile_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (role = 'teacher' OR teacher_status IN ('pending_review', 'approved'))
    )
  );

-- Student profiles: own only
CREATE POLICY "Students can view own student profile"
  ON public.student_profiles FOR SELECT
  USING (
    profile_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student')
  );

CREATE POLICY "Students can manage own student profile"
  ON public.student_profiles FOR ALL
  USING (
    profile_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student')
  );

-- --- TEACHER AVAILABILITY ---
CREATE POLICY "Teachers can manage own availability"
  ON public.teacher_availability FOR ALL
  USING (
    teacher_profile_id IN (
      SELECT id FROM public.teacher_profiles WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can view availability"
  ON public.teacher_availability FOR SELECT
  TO authenticated
  USING (true);

-- --- BLOCKED DATES ---
CREATE POLICY "Teachers can manage own blocked dates"
  ON public.blocked_dates FOR ALL
  USING (
    teacher_profile_id IN (
      SELECT id FROM public.teacher_profiles WHERE profile_id = auth.uid()
    )
  );
CREATE POLICY "Authenticated users can view blocked dates"
  ON public.blocked_dates FOR SELECT
  TO authenticated
  USING (true);

-- --- BOOKINGS: Students see only their lessons, Teachers see only their students ---
CREATE POLICY "Students can view own bookings"
  ON public.bookings FOR SELECT
  USING (
    student_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student')
  );

CREATE POLICY "Teachers can view bookings for their lessons"
  ON public.bookings FOR SELECT
  USING (
    teacher_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
  );

CREATE POLICY "Students can create bookings (for themselves)"
  ON public.bookings FOR INSERT
  WITH CHECK (
    student_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student')
  );

CREATE POLICY "Teachers can update bookings (complete/cancel)"
  ON public.bookings FOR UPDATE
  USING (
    teacher_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
  );

CREATE POLICY "Students can update own bookings (cancel)"
  ON public.bookings FOR UPDATE
  USING (
    student_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student')
  );

-- Admin: full access (optional - add if you have admin role)
CREATE POLICY "Admins have full access to bookings"
  ON public.bookings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- --- CONVERSATIONS ---
CREATE POLICY "Users can view conversations they participate in"
  ON public.conversations FOR SELECT
  USING (participant_1_id = auth.uid() OR participant_2_id = auth.uid());

CREATE POLICY "Users can create conversations (as participant)"
  ON public.conversations FOR INSERT
  WITH CHECK (participant_1_id = auth.uid() OR participant_2_id = auth.uid());

-- --- MESSAGES ---
CREATE POLICY "Users can view messages in their conversations"
  ON public.messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE participant_1_id = auth.uid() OR participant_2_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages in their conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE participant_1_id = auth.uid() OR participant_2_id = auth.uid()
    )
  );

CREATE POLICY "Users can update messages they received (mark read)"
  ON public.messages FOR UPDATE
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE participant_1_id = auth.uid() OR participant_2_id = auth.uid()
    )
  );

-- --- TEACHER REVIEWS ---
CREATE POLICY "Anyone can view teacher reviews"
  ON public.teacher_reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Students can create reviews for teachers they had lessons with"
  ON public.teacher_reviews FOR INSERT
  WITH CHECK (
    student_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student')
  );

-- =============================================================================
-- HELPER: Get or create conversation between two users
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  p_user_1_id UUID,
  p_user_2_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conv_id UUID;
  v_low UUID := LEAST(p_user_1_id, p_user_2_id);
  v_high UUID := GREATEST(p_user_1_id, p_user_2_id);
BEGIN
  IF p_user_1_id = p_user_2_id THEN
    RAISE EXCEPTION 'Cannot create conversation with self';
  END IF;

  SELECT id INTO v_conv_id
  FROM public.conversations
  WHERE participant_1_id = v_low AND participant_2_id = v_high;

  IF v_conv_id IS NULL THEN
    INSERT INTO public.conversations (participant_1_id, participant_2_id)
    VALUES (v_low, v_high)
    RETURNING id INTO v_conv_id;
  END IF;

  RETURN v_conv_id;
END;
$$;

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER teacher_profiles_updated_at
  BEFORE UPDATE ON public.teacher_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER student_profiles_updated_at
  BEFORE UPDATE ON public.student_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
