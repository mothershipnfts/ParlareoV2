# Supabase Migration Verification Checklist

## 1. Profiles on Signup ✓

**How it works:** The `handle_new_user` trigger runs automatically when a row is inserted into `auth.users` (Supabase Auth). It reads `raw_user_meta_data` for `full_name` and `role`, then:
- Inserts into `profiles` (id, email, full_name, role, teacher_status)
- Inserts into `teacher_profiles` if role=teacher
- Inserts into `student_profiles` if role=student

**SignUp.jsx** passes metadata:
```js
options: { data: { full_name, role, teacher_status } }
```

**To verify:** Sign up a new user, then in Supabase SQL Editor:
```sql
SELECT * FROM auth.users ORDER BY created_at DESC LIMIT 1;
SELECT * FROM public.profiles ORDER BY created_at DESC LIMIT 1;
SELECT * FROM public.student_profiles ORDER BY created_at DESC LIMIT 1;  -- if student
-- or
SELECT * FROM public.teacher_profiles ORDER BY created_at DESC LIMIT 1;  -- if teacher
```

**Note:** If "Confirm email" is enabled in Supabase Auth settings, the user is created when they click the confirmation link. The trigger runs at that moment.

---

## 2. Tab Persistence (UUID) ✓

| Tab | Component | Query | Status |
|-----|-----------|-------|--------|
| My Lessons (Student) | StudentDashboard | `bookings.eq("student_id", authUser.id)` | ✓ |
| My Lessons (Student) | MyLessons page | `bookings.eq("student_id", authUser.id)` | ✓ |
| My Students (Teacher) | TeacherStudentsTab | `bookings.eq("teacher_id", user.id)` | ✓ |

All use `user.id` (UUID) from `useAuth()`.

---

## 3. Messaging – Conversation on Booking ✓

**Trigger added:** `on_booking_created_create_conversation` runs AFTER INSERT on `bookings`. It calls `get_or_create_conversation(student_id, teacher_id)` so a row is inserted into `conversations` when a booking is created.

**To apply:** Run in Supabase SQL Editor:
```sql
-- From supabase/migrations/20250319000001_create_conversation_on_booking.sql
CREATE OR REPLACE FUNCTION public.create_conversation_on_booking()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.student_id IS NOT NULL AND NEW.teacher_id IS NOT NULL AND NEW.student_id != NEW.teacher_id THEN
    PERFORM public.get_or_create_conversation(NEW.student_id, NEW.teacher_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_booking_created_create_conversation ON public.bookings;
CREATE TRIGGER on_booking_created_create_conversation
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.create_conversation_on_booking();
```

**IntegratedChat** also creates conversations on-demand via `get_or_create_conversation` when loading the Messages tab (for contacts from bookings). The trigger ensures the conversation exists as soon as a booking is inserted.

---

## 4. Email vs UUID – No 400s ✓

**Migrated components (use UUID):**
- StudentDashboard, MyLessons
- TeacherStudentsTab
- IntegratedChat
- ManageSchedule
- PlacementTest
- AuthContext (profiles by id)

**Still using Base44 (email-based):** BookLessons, BrowseTeachers, TeacherProfile, TeacherWallet, Packages, PDFLessonStore, ClassroomTab, etc. These call Base44 APIs, not Supabase, so they do not hit Supabase with email and will not cause 400s from Supabase.

**Supabase tables** use `student_id` and `teacher_id` (UUID). No email-based filters are used in migrated code.
