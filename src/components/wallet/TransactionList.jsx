import React from "react";
import { ArrowDownLeft, ArrowUpRight, RotateCcw, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

const TYPE_ICONS = {
  payment_received: { icon: ArrowDownLeft, color: "text-emerald-500", bg: "bg-emerald-50" },
  withdrawal: { icon: ArrowUpRight, color: "text-blue-500", bg: "bg-blue-50" },
  refund: { icon: RotateCcw, color: "text-orange-500", bg: "bg-orange-50" }
};

const STATUS_COLORS = {
  completed: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700"
};

const STATUS_ICONS = {
  completed: CheckCircle2,
  pending: Clock,
  failed: XCircle
};

export default function TransactionList({ transactions }) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
        <p className="text-gray-400 text-sm">No transactions yet</p>
        <p className="text-gray-300 text-xs mt-1">Your activity will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((txn, i) => {
        const typeData = TYPE_ICONS[txn.type];
        const TypeIcon = typeData?.icon || ArrowDownLeft;
        const StatusIcon = STATUS_ICONS[txn.status] || CheckCircle2;

        const isIncoming = txn.type === 'payment_received';
        const label = txn.type === 'payment_received'
          ? `Lesson: ${txn.lessons_count || 1} x ${txn.package_type?.replace(/_/g, ' ')}`
          : txn.type === 'withdrawal'
          ? `Withdrawal via ${txn.withdrawal_method}`
          : 'Refund';

        return (
          <motion.div
            key={txn.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="border shadow-sm hover:shadow-md transition">
              <CardContent className="p-4 flex items-center gap-4">
                {/* Icon */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${typeData?.bg}`}>
                  <TypeIcon className={`w-5 h-5 ${typeData?.color}`} />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#1a1b4b] truncate">{label}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-500">
                      {txn.created_date ? new Date(txn.created_date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      }) : 'Just now'}
                    </p>
                    {txn.student_name && (
                      <>
                        <span className="text-gray-300">•</span>
                        <p className="text-xs text-gray-500">{txn.student_name}</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Amount and status */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${isIncoming ? 'text-emerald-600' : 'text-blue-600'}`}>
                    {isIncoming ? '+' : '-'}€{Math.abs(txn.amount).toFixed(2)}
                  </p>
                  <div className="flex items-center gap-1 justify-end mt-1">
                    <StatusIcon className="w-3 h-3" />
                    <Badge className={`text-xs rounded-full px-2 py-0.5 ${STATUS_COLORS[txn.status]}`}>
                      {txn.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}