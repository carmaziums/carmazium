"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Building2,
  User,
  Globe,
  MapPin,
  CreditCard,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Lock,
  AlertCircle,
  LogOut,
  Loader2,
  FileSpreadsheet,
  Upload,
  FileImage,
  X,
  Eye,
  IdCard,
  Receipt,
  FileCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getDealerKyc, submitDealerKyc, DealerKycData } from "@/lib/dealerApi";
import { uploadImage } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// ─── File Upload Component ─────────────────────────────────────────────────────

interface FileUploadFieldProps {
  label: string;
  hint: string;
  fieldName: string;
  value: string;
  onUpload: (fieldName: string, url: string) => void;
  onClear: (fieldName: string) => void;
  isApproved: boolean;
  rejectionNote: string | null;
  isSubmitting: boolean;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

function FileUploadField({
  label,
  hint,
  fieldName,
  value,
  onUpload,
  onClear,
  isApproved,
  rejectionNote,
  isSubmitting,
  icon: Icon,
}: FileUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (isApproved || isSubmitting) return;
    setUploadError("");

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setUploadError("File too large. Max size is 10MB.");
      return;
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      setUploadError("Only JPG, PNG, WEBP, or PDF files are accepted.");
      return;
    }

    setUploading(true);
    try {
      const url = await uploadImage(file, "listings", "kyc");
      onUpload(fieldName, url);
    } catch (err: any) {
      setUploadError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const isImage = value && (value.includes(".jpg") || value.includes(".jpeg") || value.includes(".png") || value.includes(".webp"));

  const borderClass = isApproved
    ? "border-emerald-500/30 bg-emerald-500/5"
    : rejectionNote
    ? "border-red-500/30 bg-red-500/5"
    : dragging
    ? "border-primary/60 bg-primary/5"
    : "border-white/10 bg-slate-950/50";

  return (
    <div className="space-y-1.5 text-left">
      <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Icon size={11} className={isApproved ? "text-emerald-500" : rejectionNote ? "text-red-400" : "text-slate-500"} />
          {label}
        </span>
        {isApproved && (
          <span className="flex items-center gap-1 text-[8px] font-black text-emerald-400 uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
            <Lock size={8} /> LOCKED &amp; VERIFIED
          </span>
        )}
      </label>

      {value && !uploading ? (
        /* ── Preview Block ── */
        <div className={`rounded-xl border p-3 transition-all ${borderClass}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isApproved ? "bg-emerald-500/10" : "bg-slate-900"}`}>
              {isImage ? (
                <FileImage size={18} className={isApproved ? "text-emerald-400" : "text-primary"} />
              ) : (
                <FileCheck size={18} className={isApproved ? "text-emerald-400" : "text-primary"} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {isApproved ? "✓ Document Verified" : "Document Uploaded"}
              </p>
              <p className="text-[10px] text-slate-500 truncate">{value.split("/").pop()}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="Preview"
              >
                <Eye size={13} />
              </a>
              {!isApproved && !isSubmitting && (
                <button
                  type="button"
                  onClick={() => onClear(fieldName)}
                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                  title="Remove"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
          {isImage && (
            <div className="mt-2.5 rounded-lg overflow-hidden border border-white/5 max-h-24">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="Document preview" className="w-full h-24 object-cover opacity-80" />
            </div>
          )}
        </div>
      ) : (
        /* ── Upload Drop Zone ── */
        <div
          className={`rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer ${borderClass} ${
            isApproved || isSubmitting ? "opacity-50 pointer-events-none" : "hover:border-primary/40 hover:bg-primary/5"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !isApproved && !isSubmitting && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={handleInputChange}
            disabled={isApproved || isSubmitting}
          />

          <div className="flex flex-col items-center justify-center py-5 px-4 gap-2">
            {uploading ? (
              <>
                <Loader2 size={22} className="animate-spin text-primary" />
                <p className="text-xs font-semibold text-slate-300">Uploading securely...</p>
              </>
            ) : (
              <>
                <div className="p-2 rounded-lg bg-slate-900 border border-white/5">
                  <Upload size={16} className="text-slate-400" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-300">
                    {dragging ? "Drop file here" : "Click or drag to upload"}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {uploadError && (
        <p className="text-[10px] text-red-500 font-semibold flex items-start gap-1">
          <AlertCircle size={10} className="shrink-0 mt-0.5" />
          <span>{uploadError}</span>
        </p>
      )}

      {rejectionNote && (
        <p className="text-[10px] text-red-400 font-semibold leading-relaxed flex items-start gap-1">
          <AlertCircle size={10} className="shrink-0 mt-0.5" />
          <span>{rejectionNote}</span>
        </p>
      )}
    </div>
  );
}

// ─── Main KYC Overlay Component ────────────────────────────────────────────────

export function KycOverlayForm() {
  const { profile, signOut, refreshProfile } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [kycData, setKycData] = useState<DealerKycData | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ── Text Form Fields ──
  const [formData, setFormData] = useState({
    companyHouseName: "",
    representativeName: "",
    representativePosition: "",
    directorName: "",
    personOfSignificantControl: "",
    vatNumber: "",
    companyRegistrationNumber: "",
    businessWebsite: "",
    businessRegisteredAddress: "",
    tradingAddress: "",
    googleReviewsLink: "",
    paymentReference: "",
  });

  // ── File Upload URL Fields ──
  const [fileUrls, setFileUrls] = useState({
    directorIdProof: "",
    vatProof: "",
    companyRegistrationProof: "",
    paymentScreenshot: "",
  });

  // ── Load existing KYC record on mount ──
  useEffect(() => {
    async function loadKyc() {
      try {
        const kyc = await getDealerKyc();
        setKycData(kyc);
        if (kyc) {
          setFormData({
            companyHouseName: kyc.companyHouseName || "",
            representativeName: kyc.representativeName || "",
            representativePosition: kyc.representativePosition || "",
            directorName: kyc.directorName || "",
            personOfSignificantControl: kyc.personOfSignificantControl || "",
            vatNumber: kyc.vatNumber || "",
            companyRegistrationNumber: kyc.companyRegistrationNumber || "",
            businessWebsite: kyc.businessWebsite || "",
            businessRegisteredAddress: kyc.businessRegisteredAddress || "",
            tradingAddress: kyc.tradingAddress || "",
            googleReviewsLink: kyc.googleReviewsLink || "",
            paymentReference: kyc.paymentReference || "",
          });
          setFileUrls({
            directorIdProof: kyc.directorIdProof || "",
            vatProof: kyc.vatProof || "",
            companyRegistrationProof: kyc.companyRegistrationProof || "",
            paymentScreenshot: kyc.paymentScreenshot || "",
          });
        }
      } catch (err: any) {
        console.error("Failed to load dealer KYC info:", err);
      } finally {
        setLoading(false);
      }
    }
    loadKyc();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = (fieldName: string, url: string) => {
    setFileUrls((prev) => ({ ...prev, [fieldName]: url }));
  };

  const handleFileClear = (fieldName: string) => {
    setFileUrls((prev) => ({ ...prev, [fieldName]: "" }));
  };

  const isFieldApproved = (fieldName: string): boolean => {
    if (!kycData?.documentStatuses) return false;
    return kycData.documentStatuses[fieldName]?.status === "APPROVED";
  };

  const getFieldRejectionNote = (fieldName: string): string | null => {
    if (!kycData?.documentStatuses) return null;
    const item = kycData.documentStatuses[fieldName];
    return item?.status === "REJECTED" ? item.note : null;
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/");
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  const validateStep = (step: number): boolean => {
    setErrorMsg("");
    if (step === 1) {
      if (!formData.companyHouseName.trim()) { setErrorMsg("Company Name is required."); return false; }
      if (!formData.representativeName.trim()) { setErrorMsg("Representative Name is required."); return false; }
      if (!formData.representativePosition.trim()) { setErrorMsg("Representative Position is required."); return false; }
      if (!formData.directorName.trim()) { setErrorMsg("Director Name is required."); return false; }
      if (!formData.personOfSignificantControl.trim()) { setErrorMsg("Person of Significant Control (PSC) is required."); return false; }
    } else if (step === 2) {
      if (!formData.vatNumber.trim()) { setErrorMsg("VAT Number is required."); return false; }
      if (!formData.companyRegistrationNumber.trim()) { setErrorMsg("Company Registration Number is required."); return false; }
      if (!formData.businessWebsite.trim()) { setErrorMsg("Business Website is required."); return false; }
      if (!formData.businessRegisteredAddress.trim()) { setErrorMsg("Registered Business Address is required."); return false; }
    } else if (step === 3) {
      if (!formData.paymentReference.trim()) { setErrorMsg("Bank Transfer Reference is required."); return false; }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(activeStep)) setActiveStep((prev) => Math.min(prev + 1, 3));
  };

  const prevStep = () => {
    setErrorMsg("");
    setActiveStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(3)) return;

    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      // Send ALL fields in the payload — the backend service locks approved fields
      // by reading their values from the database (ignoring what arrives in the DTO).
      // Previously we skipped approved fields here, which caused the backend's
      // class-validator to reject the request with 400 "field should not be empty"
      // because required fields were absent from the payload.
      const payload: Partial<DealerKycData> = {
        ...formData,
        ...fileUrls,
      };

      const response = await submitDealerKyc(payload);
      setKycData(response);
      setSuccessMsg("KYC documents submitted successfully! Our administrators have been notified.");
      await refreshProfile();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit KYC data. Please verify your fields and try again.");
    } finally {
      setSubmitting(false);

    }
  };

  // ─── Render Loading ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md text-white">
        <Loader2 className="animate-spin text-primary mb-4" size={48} />
        <p className="text-sm tracking-wider uppercase text-slate-400 font-semibold font-heading">
          Loading Security Profiles...
        </p>
      </div>
    );
  }

  // ─── Render "Approved" State ─────────────────────────────────────────────────
  // Edge case: if the KYC is APPROVED but the layout hasn't unmounted this
  // component yet (profile refresh still in-flight), show a success screen
  // and push to the dashboard so the layout re-evaluates the guard.
  if (kycData && kycData.status === "APPROVED") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
        <div className="dealer-glass-card max-w-xl w-full p-8 md:p-10 border border-emerald-500/20 relative overflow-hidden flex flex-col items-center text-center">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-primary to-emerald-500" />
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-6">
            <CheckCircle2 size={40} className="text-emerald-400" />
          </div>
          <h2 className="text-2xl md:text-3xl font-black font-heading text-white tracking-tight mb-3">
            KYC APPROVED
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-8">
            Your dealership has been fully verified. Click below to access your dashboard.
          </p>
          <button
            onClick={() => router.push("/dashboard/dealer")}
            className="flex items-center justify-center gap-2 px-8 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          >
            <Check size={14} />
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ─── Render "Under Review" State ─────────────────────────────────────────────
  if (kycData && kycData.status === "PENDING") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="dealer-glass-card max-w-xl w-full p-8 md:p-10 border border-white/5 relative overflow-hidden flex flex-col items-center text-center">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-primary to-amber-500 animate-pulse" />

          <div className="absolute top-4 right-4 z-20">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 transition-colors"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>

          <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-6 relative animate-float">
            <Shield size={40} className="text-amber-500" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500" />
            </span>
          </div>

          <h2 className="text-2xl md:text-3xl font-black font-heading text-white tracking-tight mb-3">
            VERIFICATION IN PROGRESS
          </h2>

          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            Your KYC application has been received and is currently under review by our superadmin team.
            Verification typically takes between 1–2 hours during business operations.
          </p>

          <div className="w-full bg-slate-900/60 border border-white/5 rounded-xl p-5 mb-8 text-left">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle2 size={16} className="text-primary" />
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Submitted Items Locker</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              All uploaded legal forms, company registry credentials, director IDs, and transfer statements are encrypted
              and locked. You will receive an automated email response as soon as our superadmin reviews your submission.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
            <button
              onClick={async () => {
                setLoading(true);
                const kyc = await getDealerKyc();
                setKycData(kyc);
                await refreshProfile();
                if (kyc?.status === "APPROVED") {
                  // Profile is refreshed (isVerified = true); push to dashboard so
                  // the layout guard re-evaluates and unmounts this overlay.
                  router.push("/dashboard/dealer");
                } else {
                  setLoading(false);
                }
              }}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold text-xs uppercase tracking-widest transition-all cursor-pointer shadow-neon"
            >
              <Loader2 className="animate-spin" size={14} />
              Check Status Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render 3-Step Form Overlay ──────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-xl p-4 overflow-y-auto custom-scrollbar">
      <div className="absolute top-10 left-10 w-96 h-96 bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-3xl my-8">
        {/* Header Block */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <Shield className="text-primary" size={24} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black font-heading text-white tracking-tight uppercase">
                Dealer KYC Portal
              </h1>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">
                Verification Required for Dashboard Access
              </p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/5 bg-slate-900/60 hover:bg-slate-900/80 text-xs font-bold text-slate-300 transition-colors"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>

        {/* Info Box if Rejected */}
        {kycData && kycData.status === "REJECTED" && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex items-start gap-3">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
            <div>
              <h3 className="text-xs font-extrabold uppercase text-red-500 tracking-wider">
                Submission Requires Attention
              </h3>
              <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                Superadmins have completed a review of your application. Specific fields were rejected and require
                revision. Previously approved fields are locked and marked with a verified badge. Please update the
                fields highlighted in red below.
              </p>
            </div>
          </div>
        )}

        {/* Steps Progress Indicator */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { step: 1, label: "Corporate Info", icon: Building2 },
            { step: 2, label: "Registrations", icon: FileSpreadsheet },
            { step: 3, label: "Bank Transfer", icon: CreditCard },
          ].map((item) => {
            const isCompleted = activeStep > item.step;
            const isActive = activeStep === item.step;
            const StepIcon = item.icon;
            return (
              <div
                key={item.step}
                className={`p-3.5 rounded-xl border transition-all duration-300 flex flex-col md:flex-row items-center gap-3 ${
                  isActive
                    ? "border-primary bg-primary/5 text-white"
                    : isCompleted
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                    : "border-white/5 bg-slate-900/40 text-slate-500"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                    isActive
                      ? "border-primary bg-primary text-white"
                      : isCompleted
                      ? "border-emerald-500 bg-emerald-500 text-slate-950"
                      : "border-white/10 bg-slate-950 text-slate-500"
                  }`}
                >
                  {isCompleted ? <Check size={16} /> : <StepIcon size={16} />}
                </div>
                <div className="text-center md:text-left">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Step 0{item.step}</p>
                  <p className="text-xs font-bold font-heading truncate max-w-[120px] md:max-w-none">{item.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="dealer-glass-card p-6 md:p-8 border border-white/5">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.2 }}
            >
              {/* ── STEP 1: CORPORATE DETAILS ── */}
              {activeStep === 1 && (
                <div className="space-y-5">
                  <h3 className="text-base font-extrabold uppercase text-white tracking-tight border-b border-white/5 pb-2">
                    Step 1: Representative &amp; Company Details
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {renderInput({ label: "Company House Registered Name", name: "companyHouseName", value: formData.companyHouseName, placeholder: "e.g. Carmazium Dealership Ltd", icon: Building2 })}
                    {renderInput({ label: "Lead Director Full Name", name: "directorName", value: formData.directorName, placeholder: "e.g. Arthur Pendragon", icon: User })}
                    {renderInput({ label: "Account Representative Full Name", name: "representativeName", value: formData.representativeName, placeholder: "e.g. John Doe", icon: User })}
                    {renderInput({ label: "Representative Job Title", name: "representativePosition", value: formData.representativePosition, placeholder: "e.g. Head of Acquisitions", icon: User })}

                    <div className="md:col-span-2">
                      {renderInput({ label: "Person of Significant Control (PSC)", name: "personOfSignificantControl", value: formData.personOfSignificantControl, placeholder: "e.g. Arthur Pendragon (85% Ownership)", icon: User })}
                    </div>
                  </div>

                  {/* Director ID Upload */}
                  <div className="pt-2 border-t border-white/5">
                    <p className="text-[10px] font-extrabold uppercase text-primary tracking-widest mb-3 flex items-center gap-1.5">
                      <IdCard size={11} />
                      Supporting Document Upload
                    </p>
                    <FileUploadField
                      label="Director ID / Passport Photo"
                      hint="Passport, driver's licence, or national ID · JPG, PNG, PDF · Max 10MB"
                      fieldName="directorIdProof"
                      value={fileUrls.directorIdProof}
                      onUpload={handleFileUpload}
                      onClear={handleFileClear}
                      isApproved={isFieldApproved("directorIdProof")}
                      rejectionNote={getFieldRejectionNote("directorIdProof")}
                      isSubmitting={submitting}
                      icon={IdCard}
                    />
                  </div>
                </div>
              )}

              {/* ── STEP 2: COMMERCIAL REGISTRATIONS ── */}
              {activeStep === 2 && (
                <div className="space-y-5">
                  <h3 className="text-base font-extrabold uppercase text-white tracking-tight border-b border-white/5 pb-2">
                    Step 2: Registrations &amp; Business Address
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {renderInput({ label: "VAT Registration Number", name: "vatNumber", value: formData.vatNumber, placeholder: "e.g. GB 123456789", icon: FileSpreadsheet })}
                    {renderInput({ label: "Company House Registration Number", name: "companyRegistrationNumber", value: formData.companyRegistrationNumber, placeholder: "e.g. 12345678", icon: FileSpreadsheet })}
                    {renderInput({ label: "Corporate Website URL", name: "businessWebsite", value: formData.businessWebsite, placeholder: "e.g. https://www.mydealership.co.uk", icon: Globe })}
                    {renderInput({ label: "Google Reviews Listing Link (Optional)", name: "googleReviewsLink", value: formData.googleReviewsLink, placeholder: "e.g. https://g.page/r/...", icon: Globe })}

                    <div className="md:col-span-2">
                      {renderTextarea({ label: "Registered Business Address", name: "businessRegisteredAddress", value: formData.businessRegisteredAddress, placeholder: "e.g. 12 Guildhall St, Folkestone, Kent, CT20 1EE", icon: MapPin })}
                    </div>
                    <div className="md:col-span-2">
                      {renderTextarea({ label: "Trading Address (If different from Registered Address)", name: "tradingAddress", value: formData.tradingAddress, placeholder: "Leave empty if identical to registered address", icon: MapPin })}
                    </div>
                  </div>

                  {/* Document Proof Uploads */}
                  <div className="pt-2 border-t border-white/5 space-y-4">
                    <p className="text-[10px] font-extrabold uppercase text-primary tracking-widest flex items-center gap-1.5">
                      <FileCheck size={11} />
                      Supporting Document Uploads
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FileUploadField
                        label="VAT Certificate / Registration Proof"
                        hint="HMRC VAT registration letter or certificate · JPG, PNG, PDF · Max 10MB"
                        fieldName="vatProof"
                        value={fileUrls.vatProof}
                        onUpload={handleFileUpload}
                        onClear={handleFileClear}
                        isApproved={isFieldApproved("vatProof")}
                        rejectionNote={getFieldRejectionNote("vatProof")}
                        isSubmitting={submitting}
                        icon={FileCheck}
                      />
                      <FileUploadField
                        label="Company House Certificate"
                        hint="Certificate of Incorporation or Companies House printout · JPG, PNG, PDF · Max 10MB"
                        fieldName="companyRegistrationProof"
                        value={fileUrls.companyRegistrationProof}
                        onUpload={handleFileUpload}
                        onClear={handleFileClear}
                        isApproved={isFieldApproved("companyRegistrationProof")}
                        rejectionNote={getFieldRejectionNote("companyRegistrationProof")}
                        isSubmitting={submitting}
                        icon={FileCheck}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 3: PAYMENT VERIFICATION ── */}
              {activeStep === 3 && (
                <div className="space-y-5">
                  <h3 className="text-base font-extrabold uppercase text-white tracking-tight border-b border-white/5 pb-2">
                    Step 3: Verification Bank Transfer
                  </h3>

                  {/* Bank Details Card */}
                  <div className="p-5 rounded-xl border border-primary/20 bg-primary/5 flex flex-col md:flex-row gap-5 items-start">
                    <CreditCard className="text-primary shrink-0 animate-float" size={32} />
                    <div className="space-y-2.5 text-slate-300 text-xs">
                      <h4 className="font-extrabold text-white text-sm uppercase tracking-wide">
                        Verify Account Activity (£1.00 GBP)
                      </h4>
                      <p className="leading-relaxed">
                        To activate your commercial privileges, we require a manual £1.00 test deposit. This process
                        validates active account ownership.
                      </p>
                      <div className="grid grid-cols-2 gap-4 py-3 px-4 bg-slate-950/80 rounded-xl border border-white/5">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">Bank Name</p>
                          <p className="font-bold text-white text-xs">Apex Clearing UK</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">Account Name</p>
                          <p className="font-bold text-white text-xs">Carmazium Capital Ltd</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">Sort Code</p>
                          <p className="font-bold text-white text-xs">40-02-50</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">Account Number</p>
                          <p className="font-bold text-white text-xs">8827 9901</p>
                        </div>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-400 italic">
                        *Please insert your unique reference ID generated below into your bank transfer ref.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {renderInput({ label: "Unique Bank Payment Reference Code", name: "paymentReference", value: formData.paymentReference, placeholder: "e.g. DEPOSIT-CARMAZIUM-XXXX", icon: CreditCard })}

                    {/* Payment Screenshot Upload */}
                    <div className="pt-2 border-t border-white/5 space-y-3">
                      <p className="text-[10px] font-extrabold uppercase text-primary tracking-widest flex items-center gap-1.5">
                        <Receipt size={11} />
                        Payment Receipt Upload
                      </p>
                      <FileUploadField
                        label="Bank Transfer Receipt / Screenshot"
                        hint="Screenshot or photo of your completed bank transfer · JPG, PNG, PDF · Max 10MB"
                        fieldName="paymentScreenshot"
                        value={fileUrls.paymentScreenshot}
                        onUpload={handleFileUpload}
                        onClear={handleFileClear}
                        isApproved={isFieldApproved("paymentScreenshot")}
                        rejectionNote={getFieldRejectionNote("paymentScreenshot")}
                        isSubmitting={submitting}
                        icon={Receipt}
                      />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Alert Messages */}
          {errorMsg && (
            <div className="mt-6 p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex items-start gap-2.5 text-xs text-red-500">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="mt-6 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-start gap-2.5 text-xs text-emerald-400">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form Actions */}
          <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
            {activeStep > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/10 bg-slate-900/60 hover:bg-slate-900 text-xs font-bold text-slate-300 transition-colors disabled:opacity-50"
              >
                <ArrowLeft size={14} />
                Back
              </button>
            ) : (
              <div />
            )}

            {activeStep < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary hover:bg-primary/95 text-white font-bold text-xs uppercase tracking-widest shadow-neon transition-all"
              >
                Continue
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs uppercase tracking-widest transition-all cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    Submitting Account...
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    Finalize Submission
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );

  // ─── Helper: Text Input Field ─────────────────────────────────────────────────
  function renderInput({
    label, name, value, placeholder, icon: Icon,
  }: {
    label: string;
    name: keyof typeof formData;
    value: string;
    placeholder: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }) {
    const isApproved = isFieldApproved(name);
    const rejectionNote = getFieldRejectionNote(name);
    return (
      <div className="space-y-1.5 text-left">
        <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider flex items-center justify-between">
          <span>{label}</span>
          {isApproved && (
            <span className="flex items-center gap-1 text-[8px] font-black text-emerald-400 uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
              <Lock size={8} /> LOCKED &amp; VERIFIED
            </span>
          )}
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <Icon size={14} className={isApproved ? "text-emerald-500" : rejectionNote ? "text-red-500" : ""} />
          </div>
          <input
            type="text"
            name={name}
            value={value}
            onChange={handleInputChange}
            disabled={isApproved || submitting}
            placeholder={placeholder}
            className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-slate-200 text-xs font-semibold placeholder:text-slate-600 transition-all ${
              isApproved
                ? "bg-slate-950/40 border-emerald-500/30 text-slate-400 select-none pointer-events-none"
                : rejectionNote
                ? "bg-red-500/5 border-red-500/40 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                : "bg-slate-950/70 border-white/5 focus:border-primary focus:ring-1 focus:ring-primary"
            }`}
          />
        </div>
        {rejectionNote && (
          <p className="text-[10px] text-red-500 font-semibold leading-relaxed flex items-start gap-1">
            <AlertCircle size={10} className="shrink-0 mt-0.5" />
            <span>{rejectionNote}</span>
          </p>
        )}
      </div>
    );
  }

  // ─── Helper: Textarea Field ───────────────────────────────────────────────────
  function renderTextarea({
    label, name, value, placeholder, icon: Icon,
  }: {
    label: string;
    name: keyof typeof formData;
    value: string;
    placeholder: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }) {
    const isApproved = isFieldApproved(name);
    const rejectionNote = getFieldRejectionNote(name);
    return (
      <div className="space-y-1.5 text-left">
        <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider flex items-center justify-between">
          <span>{label}</span>
          {isApproved && (
            <span className="flex items-center gap-1 text-[8px] font-black text-emerald-400 uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
              <Lock size={8} /> LOCKED &amp; VERIFIED
            </span>
          )}
        </label>
        <div className="relative">
          <div className="absolute top-3 left-3.5 flex items-start pointer-events-none text-slate-500">
            <Icon size={14} className={isApproved ? "text-emerald-500" : rejectionNote ? "text-red-500" : ""} />
          </div>
          <textarea
            name={name}
            value={value}
            onChange={handleInputChange}
            disabled={isApproved || submitting}
            placeholder={placeholder}
            rows={2}
            className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-slate-200 text-xs font-semibold placeholder:text-slate-600 transition-all resize-none ${
              isApproved
                ? "bg-slate-950/40 border-emerald-500/30 text-slate-400 select-none pointer-events-none"
                : rejectionNote
                ? "bg-red-500/5 border-red-500/40 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                : "bg-slate-950/70 border-white/5 focus:border-primary focus:ring-1 focus:ring-primary"
            }`}
          />
        </div>
        {rejectionNote && (
          <p className="text-[10px] text-red-500 font-semibold leading-relaxed flex items-start gap-1">
            <AlertCircle size={10} className="shrink-0 mt-0.5" />
            <span>{rejectionNote}</span>
          </p>
        )}
      </div>
    );
  }
}
