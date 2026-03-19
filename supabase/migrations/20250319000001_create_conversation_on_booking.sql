-- Create conversation when a booking is inserted so users see each other in Messages
CREATE OR REPLACE FUNCTION public.create_conversation_on_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure student and teacher are different
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
