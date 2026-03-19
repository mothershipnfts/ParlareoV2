import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Eye, Trash2, Upload, Plus, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const LEVELS = ["beginner", "elementary", "pre_intermediate", "intermediate", "upper_intermediate", "advanced"];
const CATEGORIES = ["Business", "Travel", "Daily Life", "Academic", "Technology", "Healthcare", "Law & Finance", "Culture & Arts"];
const BLANK = { title: "", description: "", level: "beginner", category: "Daily Life", price: 2, is_free: false, duration: 25, thumbnail_emoji: "📄", objectives: [], tags: [], is_published: false };

export default function AdminPDFTools({ pdfLessons, onPdfLessonsChange }) {
  const [newLesson, setNewLesson] = useState(BLANK);
  const [uploadingPDF, setUploadingPDF] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (patch) => setNewLesson(p => ({ ...p, ...patch }));

  const uploadPDF = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPDF(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set({ pdf_url: file_url });
    setUploadingPDF(false);
  };

  const saveLesson = async () => {
    if (!newLesson.title || !newLesson.pdf_url) return;
    setSaving(true);
    await base44.entities.PDFLesson.create(newLesson);
    const updated = await base44.entities.PDFLesson.list("-created_date");
    onPdfLessonsChange(updated);
    setNewLesson(BLANK);
    setSaving(false);
  };

  const togglePublish = async (lesson) => {
    await base44.entities.PDFLesson.update(lesson.id, { is_published: !lesson.is_published });
    onPdfLessonsChange(prev => prev.map(l => l.id === lesson.id ? { ...l, is_published: !l.is_published } : l));
  };

  const deleteLesson = async (lessonId) => {
    await base44.entities.PDFLesson.delete(lessonId);
    onPdfLessonsChange(prev => prev.filter(l => l.id !== lessonId));
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> Upload New PDF Lesson</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Title *</label>
              <Input value={newLesson.title} onChange={e => set({ title: e.target.value })} placeholder="e.g. Business English: Meetings" className="rounded-xl" />
            </div>
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Emoji</label>
              <Input value={newLesson.thumbnail_emoji} onChange={e => set({ thumbnail_emoji: e.target.value })} placeholder="📄" className="rounded-xl" />
            </div>
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Level</label>
              <Select value={newLesson.level} onValueChange={v => set({ level: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{LEVELS.map(l => <SelectItem key={l} value={l}>{l.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Category</label>
              <Select value={newLesson.category} onValueChange={v => set({ category: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Price (USD)</label>
              <Input type="number" value={newLesson.price} onChange={e => set({ price: Number(e.target.value) })} className="rounded-xl" />
            </div>
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <Switch checked={newLesson.is_free} onCheckedChange={v => set({ is_free: v, price: v ? 0 : 2 })} />
                <span className="text-sm text-gray-500">Free</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={newLesson.is_published} onCheckedChange={v => set({ is_published: v })} />
                <span className="text-sm text-gray-500">Publish now</span>
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Description</label>
            <Textarea value={newLesson.description} onChange={e => set({ description: e.target.value })} rows={2} className="rounded-xl resize-none" />
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-2 block">PDF File *</label>
            {newLesson.pdf_url ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <Check className="w-5 h-5 text-emerald-500" />
                <span className="text-sm text-emerald-600">PDF uploaded</span>
                <button onClick={() => set({ pdf_url: undefined })} className="ml-auto text-gray-400 hover:text-red-500 text-xs">Remove</button>
              </div>
            ) : (
              <label className="flex items-center gap-3 p-5 rounded-xl border-2 border-dashed border-gray-200 cursor-pointer hover:border-[#f97066]/40 transition-all">
                {uploadingPDF ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : <Upload className="w-5 h-5 text-gray-400" />}
                <span className="text-sm text-gray-400">{uploadingPDF ? "Uploading PDF..." : "Click to upload PDF file"}</span>
                <input type="file" accept=".pdf" className="hidden" onChange={uploadPDF} />
              </label>
            )}
          </div>
          <Button onClick={saveLesson} disabled={saving || !newLesson.title || !newLesson.pdf_url} className="bg-[#f97066] hover:bg-[#e8605a] rounded-xl px-8">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />} Add Lesson
          </Button>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle>All PDF Lessons ({pdfLessons.length})</CardTitle></CardHeader>
        <CardContent>
          {pdfLessons.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No PDF lessons uploaded yet</p>
          ) : (
            <div className="space-y-3">
              {pdfLessons.map(lesson => (
                <div key={lesson.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100">
                  <span className="text-2xl">{lesson.thumbnail_emoji || "📄"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#1a1b4b] truncate">{lesson.title}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs rounded-full capitalize">{lesson.level?.replace(/_/g, " ")}</Badge>
                      {lesson.is_free ? (
                        <Badge className="bg-emerald-100 text-emerald-700 text-xs rounded-full border-0">Free</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-600 text-xs rounded-full border-0">${lesson.price}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{lesson.is_published ? "Live" : "Draft"}</span>
                    <Switch checked={lesson.is_published} onCheckedChange={() => togglePublish(lesson)} />
                    <button onClick={() => window.open(lesson.pdf_url, "_blank")} className="text-gray-400 hover:text-[#1a1b4b]"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => deleteLesson(lesson.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}