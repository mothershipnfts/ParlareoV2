import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { GraduationCap, Upload, Check, Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";

const LESSON_TYPES = ["conversation", "grammar", "business", "exam_prep", "kids", "pronunciation"];
const SPECIALIZATIONS = ["IELTS", "TOEFL", "Business English", "Travel English", "Academic Writing", "Daily Conversation", "Job Interviews", "Children (6-12)", "Teenagers"];

export default function TeacherSignup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    full_name: "", email: "", nationality: "", bio: "",
    years_experience: "", lesson_types: [], specializations: [],
    identity_doc_url: "", certificate_urls: []
  });
  const [uploadingId, setUploadingId] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);

  const update = (key, val) => setForm(p => ({ ...p, [key]: val }));
  const toggleArr = (key, val) => setForm(p => ({
    ...p, [key]: p[key].includes(val) ? p[key].filter(x => x !== val) : [...p[key], val]
  }));

  const uploadFile = async (file, type) => {
    if (type === 'id') setUploadingId(true); else setUploadingCert(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    if (type === 'id') { update('identity_doc_url', file_url); setUploadingId(false); }
    else { update('certificate_urls', [...form.certificate_urls, file_url]); setUploadingCert(false); }
  };

  const handleSubmit = async () => {
    setLoading(true);
    await base44.entities.TeacherSignupRequest.create({
      ...form,
      years_experience: Number(form.years_experience),
      status: "pending"
    });
    // If user is logged in, mark their teacher_status as pending_review
    try {
      const me = await base44.auth.me();
      if (me) await base44.auth.updateMe({ teacher_status: "pending_review" });
    } catch (_) {}
    setLoading(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0d0e1f] flex items-center justify-center px-6">
        <div className="text-center text-white max-w-md">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Application Submitted!</h1>
          <p className="text-white/60 mb-8">Your teacher application has been received. Our admin team will review your credentials and get back to you within 2-3 business days.</p>
          <Button onClick={() => navigate(createPageUrl("Home"))} className="bg-[#f97066] hover:bg-[#e8605a] rounded-full px-8">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0e1f] text-white">
      <nav className="px-6 py-5 flex items-center gap-4 border-b border-white/5">
        <button onClick={() => navigate(createPageUrl("Home"))} className="text-white/50 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#f97066] flex items-center justify-center">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold">Apply as Teacher</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {[1, 2, 3].map(s => (
            <div key={s} className={`w-8 h-2 rounded-full transition-all ${step >= s ? 'bg-[#f97066]' : 'bg-white/10'}`} />
          ))}
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h2 className="text-2xl font-bold mb-2">Tell us about yourself</h2>
              <p className="text-white/50 mb-8">Basic information about you as a teacher</p>
              <div className="space-y-5">
                <div>
                  <label className="text-sm text-white/60 mb-2 block">Full Name *</label>
                  <Input value={form.full_name} onChange={e => update('full_name', e.target.value)} placeholder="Your full name" className="bg-white/5 border-white/10 text-white placeholder-white/20" />
                </div>
                <div>
                  <label className="text-sm text-white/60 mb-2 block">Email Address *</label>
                  <Input value={form.email} onChange={e => update('email', e.target.value)} placeholder="your@email.com" type="email" className="bg-white/5 border-white/10 text-white placeholder-white/20" />
                </div>
                <div>
                  <label className="text-sm text-white/60 mb-2 block">Nationality</label>
                  <Input value={form.nationality} onChange={e => update('nationality', e.target.value)} placeholder="e.g. British, American" className="bg-white/5 border-white/10 text-white placeholder-white/20" />
                </div>
                <div>
                  <label className="text-sm text-white/60 mb-2 block">Years of Teaching Experience</label>
                  <Input value={form.years_experience} onChange={e => update('years_experience', e.target.value)} placeholder="e.g. 5" type="number" className="bg-white/5 border-white/10 text-white placeholder-white/20" />
                </div>
                <div>
                  <label className="text-sm text-white/60 mb-2 block">Bio / About You *</label>
                  <Textarea value={form.bio} onChange={e => update('bio', e.target.value)} placeholder="Tell students about your teaching style, experience, and approach..." rows={4} className="bg-white/5 border-white/10 text-white placeholder-white/20 resize-none" />
                </div>
              </div>
              <Button onClick={() => setStep(2)} disabled={!form.full_name || !form.email || !form.bio} className="w-full mt-8 bg-[#f97066] hover:bg-[#e8605a] rounded-xl h-12">
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h2 className="text-2xl font-bold mb-2">Your teaching expertise</h2>
              <p className="text-white/50 mb-8">What type of lessons do you teach?</p>
              <div className="mb-6">
                <label className="text-sm text-white/60 mb-3 block">Lesson Types</label>
                <div className="flex flex-wrap gap-2">
                  {LESSON_TYPES.map(t => (
                    <button key={t} onClick={() => toggleArr('lesson_types', t)}
                      className={`px-4 py-2 rounded-full text-sm border transition-all capitalize ${form.lesson_types.includes(t) ? 'bg-[#f97066] border-[#f97066] text-white' : 'border-white/20 text-white/60 hover:border-white/40'}`}>
                      {t.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-8">
                <label className="text-sm text-white/60 mb-3 block">Specializations</label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALIZATIONS.map(s => (
                    <button key={s} onClick={() => toggleArr('specializations', s)}
                      className={`px-4 py-2 rounded-full text-sm border transition-all ${form.specializations.includes(s) ? 'bg-[#1a1b4b] border-[#1a1b4b]/50 text-white' : 'border-white/20 text-white/60 hover:border-white/40'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setStep(1)} variant="outline" className="flex-1 border-white/20 text-white bg-transparent hover:bg-white/5 rounded-xl h-12">Back</Button>
                <Button onClick={() => setStep(3)} className="flex-1 bg-[#f97066] hover:bg-[#e8605a] rounded-xl h-12">Continue <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h2 className="text-2xl font-bold mb-2">Identity & Certificates</h2>
              <p className="text-white/50 mb-8">Required for verification. All documents are reviewed securely by our admin team.</p>
              <div className="space-y-6">
                <div className="p-6 rounded-2xl border border-white/10 bg-white/3">
                  <h3 className="font-semibold mb-1">Proof of Identity *</h3>
                  <p className="text-sm text-white/40 mb-4">Passport, driver's license, or national ID</p>
                  {form.identity_doc_url ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <Check className="w-5 h-5 text-emerald-400" />
                      <span className="text-sm text-emerald-400">Identity document uploaded</span>
                      <button onClick={() => update('identity_doc_url', '')} className="ml-auto text-white/30 hover:text-white/60 text-xs">Remove</button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-white/20 cursor-pointer hover:border-[#f97066]/40 transition-all">
                      {uploadingId ? <Loader2 className="w-5 h-5 animate-spin text-white/50" /> : <Upload className="w-5 h-5 text-white/40" />}
                      <span className="text-sm text-white/50">{uploadingId ? 'Uploading...' : 'Click to upload ID document'}</span>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => e.target.files[0] && uploadFile(e.target.files[0], 'id')} />
                    </label>
                  )}
                </div>
                <div className="p-6 rounded-2xl border border-white/10 bg-white/3">
                  <h3 className="font-semibold mb-1">Language Certificates</h3>
                  <p className="text-sm text-white/40 mb-4">CELTA, DELTA, TEFL, TESOL, degree, or other qualifications</p>
                  {form.certificate_urls.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {form.certificate_urls.map((url, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-sm text-emerald-400">Certificate {i + 1} uploaded</span>
                          <button onClick={() => update('certificate_urls', form.certificate_urls.filter((_, j) => j !== i))} className="ml-auto text-white/30 hover:text-white/60 text-xs">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-white/20 cursor-pointer hover:border-[#f97066]/40 transition-all">
                    {uploadingCert ? <Loader2 className="w-5 h-5 animate-spin text-white/50" /> : <Upload className="w-5 h-5 text-white/40" />}
                    <span className="text-sm text-white/50">{uploadingCert ? 'Uploading...' : 'Add a certificate'}</span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => e.target.files[0] && uploadFile(e.target.files[0], 'cert')} />
                  </label>
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <Button onClick={() => setStep(2)} variant="outline" className="flex-1 border-white/20 text-white bg-transparent hover:bg-white/5 rounded-xl h-12">Back</Button>
                <Button onClick={handleSubmit} disabled={loading || !form.identity_doc_url} className="flex-1 bg-[#f97066] hover:bg-[#e8605a] rounded-xl h-12">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Application'}
                </Button>
              </div>
              <p className="text-center text-xs text-white/30 mt-4">By submitting, you agree to our verification process. Documents are kept secure.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}