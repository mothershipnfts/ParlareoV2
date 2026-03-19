import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Clock, AlertCircle, Loader2, Target } from "lucide-react";
import { motion } from "framer-motion";

export default function TeacherHomeTab({ user }) {
  const [teacher, setTeacher] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [activeBookings, setActiveBookings] = useState([]);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [commissionInfo, setCommissionInfo] = useState(null);
  const [currentStudents, setCurrentStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get teacher profile
      const teachers = await base44.entities.TeacherProfile.filter({
        user_email: user.email
      });
      if (teachers.length > 0) {
        setTeacher(teachers[0]);

        // Get commission info
        const commResponse = await base44.functions.invoke('getTeacherCommissionRate', {
          teacher_email: user.email
        });
        setCommissionInfo(commResponse.data);
      }

      // Get this month's completed bookings for earnings
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const [allBookings, activeBookings, txns] = await Promise.all([
        base44.entities.Booking.filter({ teacher_email: user.email, status: 'completed' }),
        base44.entities.Booking.filter({ teacher_email: user.email, status: 'scheduled' }),
        base44.entities.WalletTransaction.filter({ teacher_email: user.email, type: 'payment_received' }),
      ]);
      setBookings(allBookings);
      setActiveBookings(activeBookings);
      setWalletTransactions(txns);

      // Get unique current students (those with active bookings or subscriptions)
      const studentEmails = new Set();
      activeBookings.forEach(b => studentEmails.add(b.student_email));

      // From subscriptions
      const subscriptions = await base44.entities.StudentTeacherSubscription.filter({
        teacher_email: user.email,
        subscription_status: 'active'
      });
      subscriptions.forEach(s => studentEmails.add(s.student_email));

      // Fetch student profiles for display
      if (studentEmails.size > 0) {
        const profiles = await base44.entities.StudentProfile.filter({
          user_email: { $in: Array.from(studentEmails) }
        });
        setCurrentStudents(profiles);
      }
    } catch (error) {
      console.error('Error loading teacher data:', error);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
      </div>
    );
  }

  // Calculate this month earnings from actual wallet transactions (net after commission)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const thisMonthEarnings = walletTransactions
    .filter(t => new Date(t.created_date) >= monthStart)
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  // Upcoming lesson value from scheduled bookings
  const upcomingValue = activeBookings.reduce((sum, b) => {
    return sum + (b.session_duration === 25 ? teacher?.lesson_price_25 || 0 : teacher?.lesson_price_50 || 0);
  }, 0);

  const tierProgress = commissionInfo ? (commissionInfo.completed_lessons / commissionInfo.lessons_to_next_tier + commissionInfo.completed_lessons) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1a1b4b]">Welcome, {teacher?.full_name || 'Teacher'}!</h1>
        <p className="text-gray-400 text-sm mt-1">Your teaching analytics and performance overview</p>
      </div>

      {/* Revenue Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border border-blue-100 bg-gradient-to-br from-blue-50 to-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Monthly Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">This Month Earnings</p>
              <p className="text-3xl font-bold text-[#1a1b4b]">€{thisMonthEarnings.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Upcoming Lesson Value (Booked)</p>
              <p className="text-xl font-semibold text-blue-600">€{upcomingValue.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tiered Commission Progress */}
      {commissionInfo && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border border-amber-100 bg-gradient-to-br from-amber-50 to-amber-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-600" />
                Commission Tier Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-amber-900">{commissionInfo.tier_name}</span>
                  <Badge className="bg-amber-200 text-amber-900">
                    {(commissionInfo.commission_rate * 100).toFixed(1)}% Commission
                  </Badge>
                </div>
                <div className="w-full bg-amber-200 rounded-full h-3">
                  <div
                    className="bg-amber-600 h-3 rounded-full transition-all"
                    style={{ width: `${Math.min(tierProgress, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-amber-700 mt-2">
                  {commissionInfo.lessons_to_next_tier > 0
                    ? `${commissionInfo.lessons_to_next_tier} lessons until next tier`
                    : "You've reached the highest tier! 🎉"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-2 bg-white rounded-lg">
                  <p className="text-gray-500">Lessons Taught</p>
                  <p className="font-bold text-[#1a1b4b]">{commissionInfo.completed_lessons}</p>
                </div>
                <div className="p-2 bg-white rounded-lg">
                  <p className="text-gray-500">Net Rate</p>
                  <p className="font-bold text-[#1a1b4b]">{(commissionInfo.teacher_net_rate * 100).toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Current Students */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border border-green-100 bg-gradient-to-br from-green-50 to-green-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-green-600" />
              My Current Students ({currentStudents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentStudents.length > 0 ? (
              <div className="space-y-2">
                {currentStudents.map(student => (
                  <div key={student.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-100">
                    <div>
                      <p className="font-semibold text-[#1a1b4b]">{student.full_name}</p>
                      <p className="text-xs text-gray-500">{student.english_level}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No active students yet. Get started by completing your profile!</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Total Lessons Taught</p>
            <p className="text-2xl font-bold text-[#1a1b4b]">{teacher?.total_completed_lessons || 0}</p>
          </CardContent>
        </Card>
        <Card className="border">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Rating</p>
            <div className="flex items-center gap-1">
              <p className="text-2xl font-bold text-[#1a1b4b]">{(teacher?.rating || 0).toFixed(1)}</p>
              <span className="text-yellow-400">★</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Reviews</p>
            <p className="text-2xl font-bold text-[#1a1b4b]">{teacher?.total_reviews || 0}</p>
          </CardContent>
        </Card>
        <Card className="border">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Profile Views</p>
            <p className="text-2xl font-bold text-[#1a1b4b]">{teacher?.profile_views || 0}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}