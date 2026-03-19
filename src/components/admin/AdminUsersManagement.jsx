import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const SUB_TABS = ["Teachers", "Students"];

export default function AdminUsersManagement({ teachers, students }) {
  const [sub, setSub] = useState("Teachers");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {SUB_TABS.map(t => (
          <button key={t} onClick={() => setSub(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${sub === t ? "bg-white text-[#1a1b4b] shadow-sm" : "text-gray-500 hover:text-[#1a1b4b]"}`}>
            {t}
          </button>
        ))}
      </div>

      {sub === "Teachers" && (
        <div className="space-y-3">
          {teachers.length === 0 && (
            <Card className="border-0 shadow-sm"><CardContent className="p-12 text-center"><p className="text-gray-400">No teachers yet</p></CardContent></Card>
          )}
          {teachers.map(t => (
            <Card key={t.id} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[#1a1b4b]/10 flex items-center justify-center font-bold text-[#1a1b4b]">
                  {t.full_name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[#1a1b4b]">{t.full_name}</p>
                  <p className="text-xs text-gray-400">{t.user_email} · {t.nationality}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full text-xs">{t.total_lessons_taught || 0} lessons taught</Badge>
                  <Badge className={`rounded-full text-xs ${t.verification_status === "verified" ? "bg-emerald-100 text-emerald-700" : t.verification_status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                    {t.verification_status || "pending"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {sub === "Students" && (
        <div className="space-y-3">
          {students.length === 0 && (
            <Card className="border-0 shadow-sm"><CardContent className="p-12 text-center"><p className="text-gray-400">No students yet</p></CardContent></Card>
          )}
          {students.map(s => (
            <Card key={s.id} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[#1a1b4b]/10 flex items-center justify-center font-bold text-[#1a1b4b]">
                  {s.full_name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[#1a1b4b]">{s.full_name}</p>
                  <p className="text-xs text-gray-400">{s.user_email} · {s.english_level?.replace(/_/g, " ")}</p>
                </div>
                <Badge variant="outline" className="rounded-full text-xs">{s.lessons_remaining || 0} lessons</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}