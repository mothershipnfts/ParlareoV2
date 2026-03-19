import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Check, X, Eye, Loader2, MessageSquare, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function AdminCompliance({ applications, onApplicationsChange }) {
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [subFilter, setSubFilter] = useState("pending");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const filtered = applications.filter(a => subFilter === "all" || a.status === subFilter);

  const syncAll = async () => {
    setSyncing(true);
    setSyncResult(null);
    const res = await base44.functions.invoke("approveTeacher", { action: "sync" });
    setSyncResult(res.data);
    setSyncing(false);
  };

  const approve = async (app) => {
    setActionLoading(true);
    await base44.functions.invoke("approveTeacher", { appId: app.id, action: "approve" });
    onApplicationsChange(prev => prev.map(a => a.id === app.id ? { ...a, status: "approved" } : a));
    setActionLoading(false);
  };

  const confirmReject = async () => {
    if (!rejectionReason.trim()) return;
    setActionLoading(true);
    await base44.functions.invoke("approveTeacher", {
      appId: rejectModal.app.id,
      action: "reject",
      rejectionReason: rejectionReason.trim()
    });
    onApplicationsChange(prev => prev.map(a =>
      a.id === rejectModal.app.id ? { ...a, status: "rejected", rejection_reason: rejectionReason.trim() } : a
    ));
    setRejectModal(null);
    setRejectionReason("");
    setActionLoading(false);
  };

  const SUB_FILTERS = ["pending", "approved", "rejected", "all"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {SUB_FILTERS.map(f => (
          <button key={f} onClick={() => setSubFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${subFilter === f ? "bg-white text-[#1a1b4b] shadow-sm" : "text-gray-500 hover:text-[#1a1b4b]"}`}>
            {f === "all" ? "All" : f.replace("_", " ")}
            {f === "pending" && applications.filter(a => a.status === "pending").length > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {applications.filter(a => a.status === "pending").length}
              </span>
            )}
          </button>
        ))}
        </div>
        <Button size="sm" variant="outline" onClick={syncAll} disabled={syncing} className="rounded-full gap-2 text-xs">
          {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Sync Approved Teachers
        </Button>
      </div>

      {syncResult && (
        <div className={`p-3 rounded-xl text-sm ${syncResult.changes?.length > 0 ? "bg-emerald-50 text-emerald-700" : "bg-gray-50 text-gray-500"}`}>
          {syncResult.changes?.length > 0
            ? `✓ Fixed ${syncResult.changes.length} issue(s) across ${syncResult.synced} approved teachers.`
            : `✓ All ${syncResult.synced} approved teachers are already in sync.`}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="border-0 shadow-sm"><CardContent className="p-12 text-center"><p className="text-gray-400">No applications</p></CardContent></Card>
      ) : (
        filtered.map(app => (
          <Card key={app.id} className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-[#1a1b4b]">{app.full_name}</h3>
                    <Badge className={`rounded-full ${app.status === "pending" ? "bg-amber-100 text-amber-700" : app.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {app.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500 mb-1">{app.email} · {app.nationality} · {app.years_experience} yrs exp</p>
                  {app.bio && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{app.bio}</p>}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {app.lesson_types?.map(t => (
                      <Badge key={t} variant="outline" className="rounded-full text-xs capitalize">{t.replace("_", " ")}</Badge>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    {app.identity_doc_url && (
                      <button onClick={() => window.open(app.identity_doc_url, "_blank")} className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                        <Eye className="w-3 h-3" /> View ID
                      </button>
                    )}
                    {app.certificate_urls?.map((url, i) => (
                      <button key={i} onClick={() => window.open(url, "_blank")} className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Cert {i + 1}
                      </button>
                    ))}
                  </div>
                  {app.status === "rejected" && app.rejection_reason && (
                    <p className="mt-2 text-xs text-red-500"><span className="font-medium">Rejection reason:</span> {app.rejection_reason}</p>
                  )}
                </div>
                {app.status === "pending" && (
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" disabled={actionLoading} onClick={() => approve(app)} className="bg-emerald-500 hover:bg-emerald-600 rounded-full">
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1" /> Approve</>}
                    </Button>
                    <Button size="sm" disabled={actionLoading} onClick={() => { setRejectionReason(""); setRejectModal({ app }); }} className="bg-red-500 hover:bg-red-600 rounded-full">
                      <X className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={!!rejectModal} onOpenChange={(open) => !open && setRejectModal(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-red-500" /> Reason for Rejection
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-gray-500 mb-3">
              Provide a clear reason for <strong>{rejectModal?.app?.full_name}</strong>. This will be shown to the teacher.
            </p>
            <Textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
              placeholder="e.g. The ID document is blurry. Please resubmit a clear photo of your passport."
              rows={4} className="rounded-xl resize-none" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectModal(null)} className="rounded-full">Cancel</Button>
            <Button disabled={!rejectionReason.trim() || actionLoading} onClick={confirmReject} className="bg-red-500 hover:bg-red-600 rounded-full">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <X className="w-4 h-4 mr-1" />}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}