"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Building2,
  AlertTriangle,
  FileText,
  ExternalLink,
  MessageSquare,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
} from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { useAuth } from "@/context/AuthContext";
import { getPendingKycList, reviewKyc } from "@/lib/adminApi";
import { Button } from "@/components/ui/Button";

// The 13 fields that superadmin reviews granularly
const KYC_FIELDS = [
  { id: "companyHouseName", label: "Company House Registered Name", category: "Corporate Details" },
  { id: "directorName", label: "Lead Director Full Name", category: "Corporate Details" },
  { id: "representativeName", label: "Representative Full Name", category: "Corporate Details" },
  { id: "representativePosition", label: "Representative Job Title", category: "Corporate Details" },
  { id: "personOfSignificantControl", label: "Person of Significant Control (PSC)", category: "Corporate Details" },
  { id: "vatNumber", label: "VAT Registration Number", category: "Commercial & Contact" },
  { id: "companyRegistrationNumber", label: "Company House Registration Number", category: "Commercial & Contact" },
  { id: "businessWebsite", label: "Corporate Website URL", category: "Commercial & Contact", isLink: true },
  { id: "googleReviewsLink", label: "Google Reviews Link", category: "Commercial & Contact", isLink: true },
  { id: "businessRegisteredAddress", label: "Registered Business Address", category: "Addresses", isTextarea: true },
  { id: "tradingAddress", label: "Trading Address", category: "Addresses", isTextarea: true },
  { id: "paymentReference", label: "Unique Bank Payment Reference Code", category: "Payment Verification" },
  { id: "paymentScreenshot", label: "Payment Confirmation Screenshot/Code", category: "Payment Verification" },
];

export default function AdminDealerVerificationPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [pendingList, setPendingList] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [submittingId, setSubmittingId] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  // Tracks which dealer card is expanded
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  // Tracks granular review decisions for the currently expanded dealer:
  // Key: field name, Value: { status: 'APPROVED' | 'REJECTED', note: string }
  const [decisions, setDecisions] = React.useState<Record<string, { status: "APPROVED" | "REJECTED"; note: string }>>({});

  // Auth Protection Guard
  React.useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      if (profile?.role !== "ADMIN") {
        router.replace("/dashboard");
        return;
      }
    }
  }, [user, profile, authLoading, router]);

  const loadPendingKyc = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const list = await getPendingKycList();
      setPendingList(list || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load pending dealer registrations.");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (profile?.role === "ADMIN") {
      loadPendingKyc();
    }
  }, [profile]);

  // Handle expanding/collapsing a dealer card
  const toggleExpand = (dealerKyc: any) => {
    if (expandedId === dealerKyc.id) {
      setExpandedId(null);
      setDecisions({});
    } else {
      setExpandedId(dealerKyc.id);
      
      // Initialize decisions based on existing documentStatuses
      const initialDecisions: Record<string, any> = {};
      const existingStatuses = dealerKyc.documentStatuses || {};
      
      KYC_FIELDS.forEach((field) => {
        const item = existingStatuses[field.id];
        initialDecisions[field.id] = {
          status: item?.status || "APPROVED", // Default to APPROVED to save clicks
          note: item?.note || "",
        };
      });
      
      setDecisions(initialDecisions);
    }
  };

  const handleDecisionChange = (fieldName: string, status: "APPROVED" | "REJECTED") => {
    setDecisions((prev) => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        status,
      },
    }));
  };

  const handleNoteChange = (fieldName: string, note: string) => {
    setDecisions((prev) => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        note,
      },
    }));
  };

  const submitReview = async (dealerKycId: string) => {
    setSubmittingId(dealerKycId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Structure the fields array payload
      const fieldsPayload = Object.keys(decisions).map((fieldName) => ({
        field: fieldName,
        status: decisions[fieldName].status,
        note: decisions[fieldName].status === "REJECTED" ? decisions[fieldName].note : "",
      }));

      // Validate that all rejected fields have feedback notes
      const missingNotes = fieldsPayload.filter(
        (f) => f.status === "REJECTED" && !f.note.trim()
      );
      if (missingNotes.length > 0) {
        throw new Error(
          `Please provide a rejection reason note for all rejected fields.`
        );
      }

      await reviewKyc(dealerKycId, fieldsPayload);
      setSuccessMsg("KYC review submitted successfully! Notification emails have been triggered.");
      setExpandedId(null);
      setDecisions({});
      await loadPendingKyc();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit KYC review decision.");
    } finally {
      setSubmittingId(null);
    }
  };

  if (authLoading || (user && !profile) || (loading && pendingList.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || profile?.role !== "ADMIN") return null;

  const userName = profile?.firstName
    ? `${profile.firstName} ${profile.lastName || ""}`
    : user?.email?.split("@")[0] || "Admin";

  return (
    <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
      <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
        <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />

        <main className="flex-1 space-y-8 min-w-0">
          {/* Header section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800/50 p-6 rounded-2xl border border-white/10 backdrop-blur-md">
            <div>
              <h1 className="text-3xl font-black font-heading text-white uppercase tracking-tight flex items-center gap-3">
                <ShieldCheck className="text-primary hidden sm:block" size={28} />
                Dealer KYC Reviews
              </h1>
              <p className="text-gray-400 mt-1">Granular field verification portal for dealership requests</p>
            </div>
            <Button
              onClick={loadPendingKyc}
              disabled={loading}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border-white/10 text-white"
              variant="outline"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>

          {/* Toast banners */}
          {errorMsg && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-semibold flex items-start gap-2.5">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Pending KYC list */}
          {pendingList.length === 0 ? (
            <div className="dealer-glass-card p-12 text-center border border-white/5 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 text-emerald-400">
                <Check size={28} />
              </div>
              <h3 className="text-lg font-extrabold uppercase font-heading text-white">All Caught Up!</h3>
              <p className="text-gray-400 text-xs mt-2 max-w-sm">
                No dealer registrations require document verification at this moment. Excellent work!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <span className="text-xs uppercase font-extrabold text-slate-400 tracking-wider flex items-center gap-2">
                  <Clock size={14} className="text-primary animate-pulse" />
                  Awaiting Superadmin Review ({pendingList.length})
                </span>
              </div>

              {pendingList.map((item) => {
                const isExpanded = expandedId === item.id;
                const companyName = item.dealerProfile?.companyName || "Unknown Dealership";
                const ownerEmail = item.dealerProfile?.user?.email || "No email";
                const isSubmitting = submittingId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`dealer-glass-card border transition-all duration-300 overflow-hidden ${
                      isExpanded ? "border-primary/40 shadow-[0_0_25px_rgba(237,28,36,0.15)]" : "border-white/5"
                    }`}
                  >
                    {/* Collapsed Header Summary */}
                    <div
                      onClick={() => toggleExpand(item)}
                      className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer hover:bg-white/5 transition-colors relative"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-slate-900 border border-white/5 text-primary shrink-0">
                          <Building2 size={24} />
                        </div>
                        <div>
                          <h3 className="text-base font-black font-heading text-white tracking-tight uppercase">
                            {companyName}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-400 font-semibold">
                            <span>Owner: {item.representativeName}</span>
                            <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                            <span>Email: {ownerEmail}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-stretch sm:self-auto justify-end border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0">
                        <span className="px-2.5 py-1 rounded-md text-[9px] font-extrabold uppercase tracking-wider border bg-amber-500/10 border-amber-500/20 text-amber-500 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                          Pending Review
                        </span>
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>

                    {/* Expanded Review Panel */}
                    {isExpanded && (
                      <div className="border-t border-white/5 bg-slate-950/40 p-6 md:p-8 space-y-8 animate-fadeIn">
                        {/* Summary metadata */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-900/60 border border-white/5 text-xs">
                          <div>
                            <p className="text-slate-500 uppercase font-extrabold text-[9px] tracking-wider">Representative Role</p>
                            <p className="font-bold text-white mt-0.5">{item.representativePosition}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 uppercase font-extrabold text-[9px] tracking-wider">Submitted On</p>
                            <p className="font-bold text-white mt-0.5">
                              {new Date(item.submittedAt).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500 uppercase font-extrabold text-[9px] tracking-wider">Database ID Reference</p>
                            <p className="font-bold text-slate-400 truncate mt-0.5">{item.id}</p>
                          </div>
                        </div>

                        {/* Granular Field List Grouped by Category */}
                        {renderFieldsGrouped(item)}

                        {/* Action submission block */}
                        <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex items-start gap-2.5 text-xs text-slate-400">
                            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                            <p className="max-w-md">
                              Approving all fields will immediately set overall status to <strong className="text-emerald-400">APPROVED</strong> and unlock this dealer&apos;s dashboard. Rejecting any fields will require them to correct those specific items.
                            </p>
                          </div>

                          <button
                            onClick={() => submitReview(item.id)}
                            disabled={isSubmitting}
                            className="w-full sm:w-auto px-8 py-3 rounded-lg bg-primary hover:bg-primary/95 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs uppercase tracking-widest transition-all cursor-pointer shadow-neon flex items-center justify-center gap-2"
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="animate-spin" size={14} />
                                Submitting Decision...
                              </>
                            ) : (
                              <>
                                <UserCheck size={14} />
                                Submit KYC Decision
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );

  // Group fields dynamically and render cards
  function renderFieldsGrouped(item: any) {
    const categories = ["Corporate Details", "Commercial & Contact", "Addresses", "Payment Verification"];

    return (
      <div className="space-y-6 text-left">
        {categories.map((cat) => {
          const catFields = KYC_FIELDS.filter((f) => f.category === cat);
          return (
            <div key={cat} className="space-y-3">
              <h4 className="text-xs font-black uppercase text-primary tracking-widest border-l-2 border-primary pl-2.5">
                {cat}
              </h4>
              <div className="grid grid-cols-1 gap-4">
                {catFields.map((field) => {
                  const val = item[field.id] || "—";
                  const decision = decisions[field.id] || { status: "APPROVED", note: "" };
                  const isApproved = decision.status === "APPROVED";
                  const isRejected = decision.status === "REJECTED";

                  return (
                    <div
                      key={field.id}
                      className={`p-4 rounded-xl border transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isApproved
                          ? "bg-slate-900/40 border-white/5"
                          : "bg-red-500/5 border-red-500/20"
                      }`}
                    >
                      {/* Left: Info details */}
                      <div className="space-y-1 max-w-lg min-w-0 flex-1">
                        <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">
                          {field.label}
                        </p>
                        
                        {field.isLink && val !== "—" ? (
                          <a
                            href={val}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary font-bold hover:underline flex items-center gap-1 inline-flex"
                          >
                            {val}
                            <ExternalLink size={12} />
                          </a>
                        ) : field.isTextarea ? (
                          <p className="text-xs font-semibold text-slate-200 leading-relaxed whitespace-pre-line">
                            {val}
                          </p>
                        ) : (
                          <p className="text-xs font-semibold text-slate-200 truncate">{val}</p>
                        )}
                      </div>

                      {/* Right: Actions and feedback */}
                      <div className="flex flex-col gap-2 shrink-0 md:items-end w-full md:w-auto">
                        <div className="flex gap-2">
                          {/* Approve Button */}
                          <button
                            type="button"
                            onClick={() => handleDecisionChange(field.id, "APPROVED")}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer ${
                              isApproved
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                                : "bg-slate-950/60 border-white/5 text-slate-500 hover:text-slate-300"
                            }`}
                          >
                            <Check size={12} />
                            Approve
                          </button>

                          {/* Reject Button */}
                          <button
                            type="button"
                            onClick={() => handleDecisionChange(field.id, "REJECTED")}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer ${
                              isRejected
                                ? "bg-red-500/10 border-red-500/30 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                                : "bg-slate-950/60 border-white/5 text-slate-500 hover:text-slate-300"
                            }`}
                          >
                            <X size={12} />
                            Reject
                          </button>
                        </div>

                        {/* Inline Rejection Reason Note input */}
                        {isRejected && (
                          <div className="w-full md:w-64 relative mt-1">
                            <div className="absolute top-2.5 left-2.5 text-red-500 pointer-events-none">
                              <MessageSquare size={12} />
                            </div>
                            <input
                              type="text"
                              value={decision.note}
                              onChange={(e) => handleNoteChange(field.id, e.target.value)}
                              placeholder="Reason for rejection..."
                              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-red-500/40 focus:border-red-500 rounded-lg text-[11px] font-semibold text-slate-300 placeholder:text-slate-600 focus:ring-1 focus:ring-red-500 transition-all"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
}
