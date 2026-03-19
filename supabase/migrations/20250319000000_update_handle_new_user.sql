-- Update handle_new_user to create profiles + teacher_profiles or student_profiles based on role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_full_name TEXT;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');

  -- Insert base profile
  INSERT INTO public.profiles (id, email, full_name, role, teacher_status)
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    v_role,
    CASE WHEN v_role = 'teacher' THEN 'pending_review' ELSE NULL END
  );

  -- Create role-specific profile
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
