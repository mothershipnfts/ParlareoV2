import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Save, Loader2, Eye, Calendar, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format, addDays } from "date-fns";

const LESSON_TYPES = ["conversation", "grammar", "business", "exam_prep", "kids", "pronunciation"];
const SPECIALIZATIONS = ["IELTS", "TOEFL", "Business English", "Travel English", "Academic Writing", "Daily Conversation", "Job Interviews", "Children (6-12)", "Teenagers"];
const COLORS = ['#f97066', '#1a1b4b', '#10b981', '#6366f1', '#f59e0b', '#ec4899'];

export default function TeacherProfileEdit() {
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const me = await base44.auth.me();
    const [profiles, b, avail] = await Promise.all([
      base44.entities.TeacherProfile.filter({ user_email: me.email }),
      base44.entities.Booking.filter({ created_by: me.email }),
      base44.entities.Availability.filter({ created_by: me.email })
    ]);
    if (profiles.length > 0) {
      const p = profiles[0];
      // Always enforce 60% rule on load
      p.lesson_price_25 = Math.round((p.lesson_price_50 || 35) * 0.6);
      setProfile(p);
    } else {
      // Use teacher_status from the User record to set the correct verification_status
      const verificationStatus = me.teacher_status === "approved" ? "verified" : "pending";
      const newProfile = await base44.entities.TeacherProfile.create({
        user_email: me.email, full_name: me.full_name,
        lesson_price_25: 21, lesson_price_50: 35, verification_status: verificationStatus,
        offers_video: true, offers_audio: true, is_active: me.teacher_status === "approved"
      });
      newProfile.lesson_price_25 = Math.round((newProfile.lesson_price_50 || 35) * 0.6);
      setProfile(newProfile);
    }
    setBookings(b);
    setAvailability(avail);
    setLoading(false);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setProfile(p => ({ ...p, avatar: file_url }));
    setUploadingPhoto(false);
  };

  const update = (key, val) => setProfile(p => ({ ...p, [key]: val }));
  const toggleArr = (key, val) => setProfile(p => ({
    ...p, [key]: (p[key] || []).includes(val) ? (p[key] || []).filter(x => x !== val) : [...(p[key] || []), val]
  }));

  const save = async () => {
    setSaving(true);
    await base44.entities.TeacherProfile.update(profile.id, profile);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" /></div>;

  const lessonTypeData = (profile?.lesson_types || []).map((t, i) => ({
    name: t.replace('_', ' '), value: Math.floor(Math.random() * 20 + 5)
  }));

  const next30Days = Array.from({ length: 30 }, (_, i) => {
    const d = addDays(new Date(), i);
    const dateStr = format(d, 'yyyy-MM-dd');
    return { day: format(d, 'MMM d'), slots: availability.filter(a => a.date === dateStr && !a.is_booked).length };
  });

  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "stats", label: "Analytics" },
    { id: "availability", label: "Availability" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1b4b]">My Profile</h1>
          <p className="text-gray-400 mt-1">Edit your public profile and settings</p>
        </div>
        {profile?.verification_status === 'pending' && <Badge className="bg-amber-100 text-amber-700 rounded-full">Pending Verification</Badge>}
        {profile?.verification_status === 'verified' && <Badge className="bg-emerald-100 text-emerald-700 rounded-full">✓ Verified</Badge>}
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? 'bg-white text-[#1a1b4b] shadow-sm' : 'text-gray-500 hover:text-[#1a1b4b]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "profile" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h2 className="font-bold text-[#1a1b4b] mb-4">Profile Photo</h2>
                <div className="flex items-center gap-5">
                  <div className="relative shrink-0">
                    <div className="w-24 h-24 rounded-2xl bg-[#1a1b4b]/10 overflow-hidden flex items-center justify-center">
                      {profile?.avatar && profile.avatar.startsWith("http") ? (
                        <img src={profile.avatar} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-4xl text-[#1a1b4b]/30">👤</span>
                      )}
                    </div>
                    {uploadingPhoto && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Upload a professional photo to build trust with students.</p>
                    <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="rounded-full gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      {uploadingPhoto ? "Uploading…" : "Upload Photo"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-6 space-y-5">
                <h2 className="font-bold text-[#1a1b4b]">Profile Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">Display Name</label>
                    <Input value={profile?.full_name || ''} onChange={e => update('full_name', e.target.value)} className="rounded-xl" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">Nationality</label>
                    <Input value={profile?.nationality || ''} onChange={e => update('nationality', e.target.value)} className="rounded-xl" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">Years Experience</label>
                    <Input type="number" value={profile?.years_experience || ''} onChange={e => update('years_experience', Number(e.target.value))} className="rounded-xl" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">Timezone</label>
                    <Input value={profile?.timezone || ''} onChange={e => update('timezone', e.target.value)} placeholder="e.g. GMT+0" className="rounded-xl" />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-500 mb-1 block">Bio</label>
                  <Textarea value={profile?.bio || ''} onChange={e => update('bio', e.target.value)} rows={4} className="rounded-xl resize-none" placeholder="Tell students about yourself..." />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h2 className="font-bold text-[#1a1b4b] mb-4">Teaching Focus</h2>
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-2">Lesson Types</p>
                  <div className="flex flex-wrap gap-2">
                    {LESSON_TYPES.map(t => (
                      <button key={t} onClick={() => toggleArr('lesson_types', t)}
                        className={`px-4 py-2 rounded-full text-sm border transition-all capitalize ${(profile?.lesson_types || []).includes(t) ? 'bg-[#1a1b4b] text-white border-[#1a1b4b]' : 'border-gray-200 text-gray-500 hover:border-[#1a1b4b]'}`}>
                        {t.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-2">Specializations</p>
                  <div className="flex flex-wrap gap-2">
                    {SPECIALIZATIONS.map(s => (
                      <button key={s} onClick={() => toggleArr('specializations', s)}
                        className={`px-4 py-2 rounded-full text-sm border transition-all ${(profile?.specializations || []).includes(s) ? 'bg-[#f97066] text-white border-[#f97066]' : 'border-gray-200 text-gray-500 hover:border-[#f97066]'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h2 className="font-bold text-[#1a1b4b] mb-1">Lesson Pricing</h2>
                <p className="text-xs text-gray-400 mb-4">Set your rate for a 50-minute lesson. The 25-minute price is calculated automatically at 60%.</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">Base Rate — 50-min lesson ($)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <Input
                        type="number"
                        min="1"
                        value={profile?.lesson_price_50 || ''}
                        onChange={e => {
                          const p50 = Number(e.target.value);
                          const p25 = Math.round(p50 * 0.6);
                          update('lesson_price_50', p50);
                          update('lesson_price_25', p25);
                        }}
                        className="pl-7 rounded-xl"
                        placeholder="e.g. 20"
                      />
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400">25-min lesson price</p>
                      <p className="text-sm font-bold text-[#1a1b4b]">
                        ${Math.round((profile?.lesson_price_50 || 0) * 0.6)}
                        <span className="text-xs font-normal text-gray-400 ml-1">(60% of base rate)</span>
                      </p>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Auto-calculated</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h2 className="font-bold text-[#1a1b4b] mb-4">Lesson Format</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><span className="text-lg">🎥</span><span className="text-sm font-medium">Video Lessons</span></div>
                    <Switch checked={profile?.offers_video || false} onCheckedChange={v => update('offers_video', v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><span className="text-lg">🎧</span><span className="text-sm font-medium">Audio-Only</span></div>
                    <Switch checked={profile?.offers_audio || false} onCheckedChange={v => update('offers_audio', v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><span className="text-lg">👁️</span><span className="text-sm font-medium">Profile Active</span></div>
                    <Switch checked={profile?.is_active || false} onCheckedChange={v => update('is_active', v)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button onClick={save} disabled={saving} className="w-full bg-[#f97066] hover:bg-[#e8605a] rounded-xl h-12">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {saved ? '✓ Saved!' : 'Save Changes'}
            </Button>
          </div>
        </div>
      )}

      {activeTab === "stats" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Profile Views", value: profile?.profile_views || 0 },
              { label: "Total Students", value: [...new Set(bookings.map(b => b.student_email))].length },
              { label: "Lessons Taught", value: profile?.total_lessons_taught || 0 },
              { label: "Avg. Rating", value: (profile?.rating || 0).toFixed(1) },
            ].map((stat, i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold text-[#1a1b4b]">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {lessonTypeData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-0 shadow-sm">
                <CardHeader><CardTitle className="text-base">Lesson Types</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={lessonTypeData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {lessonTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader><CardTitle className="text-base">Student Demographics</CardTitle></CardHeader>
                <CardContent>
                  {(() => {
                    const levelCounts = {};
                    bookings.forEach(b => { if (b.student_level) levelCounts[b.student_level] = (levelCounts[b.student_level] || 0) + 1; });
                    const data = Object.entries(levelCounts).map(([k, v]) => ({ name: k.replace(/_/g, ' '), value: v }));
                    if (data.length === 0) return <p className="text-gray-400 text-sm text-center py-8">No booking data yet</p>;
                    return (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={data}>
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="#1a1b4b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {activeTab === "availability" && (
        <div className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle>Availability — Next 30 Days</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={next30Days}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(v) => [`${v} slots`, 'Available']} />
                  <Bar dataKey="slots" fill="#f97066" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-3">Manage your detailed availability calendar</p>
            <Button onClick={() => window.location.href = createPageUrl("ManageAvailability")} className="bg-[#1a1b4b] hover:bg-[#2a2b5b] rounded-full">
              <Calendar className="w-4 h-4 mr-2" /> Manage Availability
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}