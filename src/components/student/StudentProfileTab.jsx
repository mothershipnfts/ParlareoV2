import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Save, Loader2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";

const INTERESTS = [
  // Professional & Academic
  "Business", "Entrepreneurship", "Finance & Investing", "Law", "Medicine & Healthcare",
  "Science", "Engineering", "Academic Writing", "Research",
  // Technology
  "Technology", "Programming & Coding", "Artificial Intelligence", "Cybersecurity", "Gaming",
  // Lifestyle & Wellbeing
  "Health & Fitness", "Mental Health", "Nutrition & Diet", "Yoga & Mindfulness", "Fashion & Style",
  // Arts & Entertainment
  "Music", "Film & TV", "Photography", "Art & Culture", "Theatre & Performing Arts", "Literature & Books",
  // Travel & Culture
  "Travel", "History", "Geography", "Languages & Linguistics", "Religion & Philosophy",
  // Social & Current Affairs
  "News & Politics", "Environment & Sustainability", "Social Justice", "Psychology",
  // Food & Leisure
  "Food & Cooking", "Sports", "Outdoor Activities", "DIY & Home Improvement", "Pets & Animals",
];

const LEVEL_LABELS = {
  beginner: "Beginner", elementary: "Elementary", pre_intermediate: "Pre-Intermediate",
  intermediate: "Intermediate", upper_intermediate: "Upper Intermediate", advanced: "Advanced"
};

export default function StudentProfileTab({ user, profile, onProfileUpdated }) {
  const [form, setForm] = useState({
    full_name: profile?.full_name || "",
    job: profile?.job || "",
    learning_goals: profile?.learning_goals || "",
    interests: profile?.interests || [],
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const toggleInterest = (val) => setForm(f => ({
    ...f,
    interests: (f.interests || []).includes(val)
      ? (f.interests || []).filter(x => x !== val)
      : [...(f.interests || []), val]
  }));

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.auth.updateMe({ avatar: file_url });
    onProfileUpdated({ ...profile });
    setUploadingPhoto(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.StudentProfile.update(profile.id, {
      full_name: form.full_name,
      job: form.job,
      learning_goals: form.learning_goals,
      interests: form.interests,
    });
    await base44.auth.updateMe({ full_name: form.full_name });
    onProfileUpdated({ ...profile, ...form });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const joinedDate = user?.created_date ? format(parseISO(user.created_date), "MMMM yyyy") : "—";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1b4b]">My Profile</h1>
          <p className="text-gray-400 mt-1">Manage your learning profile and preferences</p>
        </div>
        {profile?.english_level && (
          <Badge className="bg-blue-100 text-blue-700 rounded-full capitalize">
            {LEVEL_LABELS[profile.english_level] || profile.english_level}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Photo */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <h2 className="font-bold text-[#1a1b4b] mb-4">Profile Photo</h2>
              <div className="flex items-center gap-5">
                <div className="relative shrink-0">
                  <div className="w-24 h-24 rounded-2xl bg-[#1a1b4b]/10 overflow-hidden flex items-center justify-center">
                    {user?.avatar ? (
                      <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
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
                  <p className="text-sm text-gray-500 mb-2">Add a photo so your teacher can recognise you.</p>
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

          {/* Profile Info */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-5">
              <h2 className="font-bold text-[#1a1b4b]">Profile Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500 mb-1 block">Display Name</label>
                  <Input value={form.full_name} onChange={e => update("full_name", e.target.value)} className="rounded-xl" />
                </div>
                <div>
                  <label className="text-sm text-gray-500 mb-1 block">Email</label>
                  <Input value={user?.email || ""} disabled className="rounded-xl bg-gray-50 text-gray-400" />
                </div>
                <div>
                  <label className="text-sm text-gray-500 mb-1 block">Profession</label>
                  <Input value={form.job} onChange={e => update("job", e.target.value)} placeholder="e.g. Software Engineer" className="rounded-xl" />
                </div>
                <div>
                  <label className="text-sm text-gray-500 mb-1 block">Member Since</label>
                  <Input value={joinedDate} disabled className="rounded-xl bg-gray-50 text-gray-400" />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Learning Goals</label>
                <Textarea
                  value={form.learning_goals}
                  onChange={e => update("learning_goals", e.target.value)}
                  rows={4}
                  className="rounded-xl resize-none"
                  placeholder="What do you want to achieve with English?"
                />
              </div>
            </CardContent>
          </Card>

          {/* Interests */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <h2 className="font-bold text-[#1a1b4b] mb-1">Interests</h2>
              <p className="text-sm text-gray-400 mb-4">Your teacher uses these to personalise lessons for you.</p>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map(interest => (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`px-4 py-2 rounded-full text-sm border transition-all ${
                      (form.interests || []).includes(interest)
                        ? "bg-[#f97066] text-white border-[#f97066]"
                        : "border-gray-200 text-gray-500 hover:border-[#f97066]"
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-4">
          <Button onClick={handleSave} disabled={saving} className="w-full bg-[#f97066] hover:bg-[#e8605a] rounded-xl h-12">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {saved ? "✓ Saved!" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}