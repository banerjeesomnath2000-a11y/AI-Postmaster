import React, { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  FileVideo,
  Sparkles,
  Copy,
  Check,
  Loader2,
  Trash2,
  Utensils,
  Building,
  Globe,
  Settings,
  Facebook,
  Youtube,
  Instagram,
  AlertCircle,
  Play,
  RotateCcw,
  LogIn,
  LogOut,
  FolderHeart,
  Save,
  Clock,
  History,
  ArrowRight,
  Zap,
  ShieldCheck,
  ArrowUpRight,
  Sun,
  Moon,
} from "lucide-react";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, addDoc, getDocs, query, where, orderBy, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { auth, db, loginWithGoogle, loginAsGuest, logoutFromApp } from "./firebase";
import Logo from "./components/Logo";

interface AnalysisResult {
  title: string;
  description: string;
  hashtags: string[];
}

interface SavedCampaign {
  id: string;
  userId: string;
  title: string;
  description: string;
  hashtags: string[];
  tone: string;
  context: string;
  fileName: string;
  fileSize: number;
  createdAt: any;
}

export default function App() {
  const [view, setView] = useState<"landing" | "workspace">("landing");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [savedCampaigns, setSavedCampaigns] = useState<SavedCampaign[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showAuthBlockedModal, setShowAuthBlockedModal] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [tone, setTone] = useState<"standard" | "wholesale" | "real-estate" | "culinary">("standard");
  const [context, setContext] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<"facebook" | "instagram" | "youtube">("youtube");
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragOverRef = useRef<boolean>(false);
  const [, forceUpdate] = useState({}); // Simple helper to force render if needed

  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem("ai_postmaster_theme") === "dark";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (isDark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("ai_postmaster_theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("ai_postmaster_theme", "light");
      }
    } catch (e) {
      console.error("Failed to write theme state", e);
    }
  }, [isDark]);

  // Fetch local mock campaigns from localStorage
  const fetchLocalCampaigns = () => {
    try {
      const localData = localStorage.getItem("ai_postmaster_campaigns");
      if (localData) {
        setSavedCampaigns(JSON.parse(localData));
      } else {
        setSavedCampaigns([]);
      }
    } catch (err) {
      console.error("Error loading mock campaigns from localStorage:", err);
    }
  };

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        fetchSavedCampaigns(user.uid);
      } else {
        // Keep the local visitor active if they bypassed to Local Guest Mode
        setCurrentUser((curr) => {
          if (curr?.uid === "local_guest_user") {
            return curr;
          }
          setSavedCampaigns([]);
          return null;
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error("Google login failure:", err);
      if (err.code === "auth/popup-closed-by-user" || err.message?.includes("closed") || err.message?.includes?.("popup")) {
        setAuthError("Google Sign-In popup was closed or blocked. Enter instantly using standard Guest Mode to proceed.");
        setShowAuthBlockedModal(true);
      } else {
        setAuthError(err.message || "Could not complete Google Sign-In.");
        setShowAuthBlockedModal(true);
      }
    }
  };

  const handleGuestLogin = async () => {
    setAuthError(null);
    setIsLoadingSaved(true);
    try {
      await loginAsGuest();
      setShowAuthBlockedModal(false);
    } catch (err: any) {
      console.warn("Guest login failure, activating local mock session:", err);
      // Seamlessly fall back to client-side local guest sandbox
      const localGuestUser = {
        uid: "local_guest_user",
        displayName: "Guest User",
        email: "guest@local.com",
        isAnonymous: true,
        photoURL: null,
      } as any;
      setCurrentUser(localGuestUser);
      fetchLocalCampaigns();
      setShowAuthBlockedModal(false);
    } finally {
      setIsLoadingSaved(false);
    }
  };

  // Custom logout handler
  const handleLogout = async () => {
    try {
      if (currentUser?.uid === "local_guest_user") {
        setCurrentUser(null);
        setSavedCampaigns([]);
      } else {
        await logoutFromApp();
      }
    } catch (err) {
      console.error("Logout error:", err);
      setCurrentUser(null);
      setSavedCampaigns([]);
    }
  };

  // Fetch saved campaigns
  const fetchSavedCampaigns = async (userId: string) => {
    if (userId === "local_guest_user") {
      fetchLocalCampaigns();
      return;
    }
    setIsLoadingSaved(true);
    try {
      const q = query(
        collection(db, "analyses"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const campaigns: SavedCampaign[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        campaigns.push({
          id: docSnap.id,
          userId: data.userId || "",
          title: data.title || "",
          description: data.description || "",
          hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
          tone: data.tone || "standard",
          context: data.context || "",
          fileName: data.fileName || "",
          fileSize: data.fileSize || 0,
          createdAt: data.createdAt,
        });
      });
      setSavedCampaigns(campaigns);
    } catch (err: any) {
      console.error("Error fetching saved campaigns from cloud, falling back to local:", err);
      fetchLocalCampaigns();
    } finally {
      setIsLoadingSaved(false);
    }
  };

  // Save current active campaign
  const saveCurrentCampaign = async () => {
    if (!currentUser) {
      setErrorMessage("Please sign in or enter guest mode to save SMM campaigns.");
      return;
    }
    if (!analysisResult) {
      setErrorMessage("No analysis result available to save. Please upload a video and generate an SMM post first.");
      return;
    }
    setIsSaving(true);
    setSaveSuccessMessage(null);
    try {
      const newCampaignId = "local_" + Date.now();
      const newDoc: SavedCampaign = {
        id: currentUser.uid === "local_guest_user" ? newCampaignId : "",
        userId: currentUser.uid,
        title: analysisResult.title,
        description: analysisResult.description,
        hashtags: analysisResult.hashtags,
        tone: tone,
        context: context,
        fileName: file ? file.name : "Uploaded Video",
        fileSize: file ? file.size : 0,
        createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      };

      if (currentUser.uid === "local_guest_user") {
        const localData = localStorage.getItem("ai_postmaster_campaigns");
        const list: SavedCampaign[] = localData ? JSON.parse(localData) : [];
        list.unshift(newDoc);
        localStorage.setItem("ai_postmaster_campaigns", JSON.stringify(list));
        setSavedCampaigns(list);
        setSaveSuccessMessage("Campaign saved to your Local guest portfolio!");
      } else {
        await addDoc(collection(db, "analyses"), {
          userId: newDoc.userId,
          title: newDoc.title,
          description: newDoc.description,
          hashtags: newDoc.hashtags,
          tone: newDoc.tone,
          context: newDoc.context,
          fileName: newDoc.fileName,
          fileSize: newDoc.fileSize,
          createdAt: Timestamp.now(),
        });
        setSaveSuccessMessage("Campaign successfully saved to your cloud portfolio!");
        fetchSavedCampaigns(currentUser.uid);
      }
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      console.warn("Error saving to cloud, writing local copy as fallback:", err);
      try {
        const localData = localStorage.getItem("ai_postmaster_campaigns");
        const list: SavedCampaign[] = localData ? JSON.parse(localData) : [];
        const fallbackId = "fallback_" + Date.now();
        const fallbackDoc: SavedCampaign = {
          id: fallbackId,
          userId: currentUser.uid,
          title: analysisResult.title,
          description: analysisResult.description,
          hashtags: analysisResult.hashtags,
          tone: tone,
          context: context,
          fileName: file ? file.name : "Uploaded Video",
          fileSize: file ? file.size : 0,
          createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        };
        list.unshift(fallbackDoc);
        localStorage.setItem("ai_postmaster_campaigns", JSON.stringify(list));
        setSavedCampaigns(list);
        setSaveSuccessMessage("Campaign saved locally (Cloud sync bypassed)!");
        setTimeout(() => setSaveSuccessMessage(null), 4000);
      } catch (backupErr) {
        setErrorMessage(`Failed to save campaign: ${err.message || err}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Delete/remove a saved campaign
  const deleteSavedCampaign = async (campaignId: string) => {
    if (!currentUser) return;
    try {
      if (currentUser.uid === "local_guest_user" || campaignId.startsWith("local_") || campaignId.startsWith("fallback_")) {
        const localData = localStorage.getItem("ai_postmaster_campaigns");
        if (localData) {
          const list: SavedCampaign[] = JSON.parse(localData);
          const filtered = list.filter((c) => c.id !== campaignId);
          localStorage.setItem("ai_postmaster_campaigns", JSON.stringify(filtered));
          setSavedCampaigns(filtered);
        } else {
          setSavedCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
        }
      } else {
        await deleteDoc(doc(db, "analyses", campaignId));
        setSavedCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
      }
    } catch (err: any) {
      console.warn("Could not delete from cloud, attempting local fallback:", err);
      // Local fallback deletion
      const localData = localStorage.getItem("ai_postmaster_campaigns");
      if (localData) {
        const list: SavedCampaign[] = JSON.parse(localData);
        const filtered = list.filter((c) => c.id !== campaignId);
        localStorage.setItem("ai_postmaster_campaigns", JSON.stringify(filtered));
        setSavedCampaigns(filtered);
      } else {
        setSavedCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
      }
    }
  };

  // Load a saved campaign from history into the active view
  const loadSavedCampaign = (campaign: SavedCampaign) => {
    setAnalysisResult({
      title: campaign.title,
      description: campaign.description,
      hashtags: campaign.hashtags,
    });
    setTone(campaign.tone as any);
    setContext(campaign.context);
    setSaveSuccessMessage(`Loaded "${campaign.title}" SMM Campaign into workspace.`);
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  // Stepper messages for a smooth progressive loading experience
  const loadingSteps = [
    "Uploading high-definition MP4 video payload...",
    "Securing media on Gemini File Storage engines...",
    "Gemini 3.5 Flash: Scanning visual structures, tracks, and frames...",
    "Writing high-converting descriptions, viral SEO copy, and active hashtags...",
  ];

  // Helper for launching stepper intervals
  const startLoadingProgress = () => {
    setLoadingStep(0);
    const interval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev >= 3) {
          clearInterval(interval);
          return 3;
        }
        return prev + 1;
      });
    }, 4500); // Progress over ~18-20s video scanning duration
    return interval;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      if (ext !== "mp4") {
        setErrorMessage("Please select a valid .mp4 video file.");
        return;
      }
      if (selectedFile.size > 2 * 1024 * 1024 * 1024) {
        setErrorMessage("File exceeds the maximum size limit of 2GB.");
        return;
      }
      setFile(selectedFile);
      setErrorMessage(null);
      // Create a local URL for instant HTML5 video player playback
      const localUrl = URL.createObjectURL(selectedFile);
      setVideoUrl(localUrl);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    dragOverRef.current = true;
    forceUpdate({});
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragOverRef.current = false;
    forceUpdate({});
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragOverRef.current = false;
    forceUpdate({});

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const ext = droppedFile.name.split('.').pop()?.toLowerCase();
      if (ext !== "mp4") {
        setErrorMessage("Please select a valid .mp4 video file.");
        return;
      }
      if (droppedFile.size > 2 * 1024 * 1024 * 1024) {
        setErrorMessage("File exceeds the maximum size limit of 2GB.");
        return;
      }
      setFile(droppedFile);
      setErrorMessage(null);
      const localUrl = URL.createObjectURL(droppedFile);
      setVideoUrl(localUrl);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }
    setAnalysisResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const executeVideoAnalysis = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setErrorMessage(null);
    setAnalysisResult(null);
    const progressInterval = startLoadingProgress();

    try {
      const formData = new FormData();
      formData.append("video", file);
      formData.append("tone", tone);
      formData.append("context", context);

      const response = await fetch("/api/analyze-video", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errText = "";
        try {
          errText = await response.text();
          const errData = JSON.parse(errText);
          throw new Error(errData.error || `Server returned error status ${response.status}`);
        } catch (_) {
          if (errText.trim().startsWith("<!doctype") || errText.trim().startsWith("<html") || errText.trim().startsWith("<!DOCTYPE")) {
            throw new Error("Received an HTML error page. The backend server might be offline or restarting.");
          }
          throw new Error(errText || `Server returned error status ${response.status}`);
        }
      }

      const text = await response.text();
      if (text.trim().startsWith("<!doctype") || text.trim().startsWith("<html") || text.trim().startsWith("<!DOCTYPE")) {
        throw new Error("Received an HTML page instead of JSON. The backend server might be offline or still starting up.");
      }

      let jsonResult: any;
      try {
        jsonResult = JSON.parse(text);
      } catch (parseErr) {
        throw new Error(`Failed to parse server response as JSON. Output was: ${text.substring(0, 100)}...`);
      }

      // Sanitize the result fields to prevent React render crashes
      const sanitizedResult: AnalysisResult = {
        title: jsonResult.title || "Untitled SEO Campaign",
        description: jsonResult.description || "No description generated.",
        hashtags: Array.isArray(jsonResult.hashtags) 
          ? jsonResult.hashtags 
          : typeof jsonResult.hashtags === "string"
            ? (jsonResult.hashtags as string).split(/[,\s]+/).filter(Boolean).map(h => h.startsWith("#") ? h : `#${h}`)
            : []
      };
      setAnalysisResult(sanitizedResult);
    } catch (err: any) {
      console.error("API error:", err);
      setErrorMessage(
        err.message || "An unexpected error occurred during analysis. Please check your network and API keys."
      );
    } finally {
      setIsAnalyzing(false);
      clearInterval(progressInterval);
    }
  };

  const triggerCopy = (text: string, identifier: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStates((prev) => ({ ...prev, [identifier]: true }));
    setTimeout(() => {
      setCopiedStates((prev) => ({ ...prev, [identifier]: false }));
    }, 2000);
  };

  // Pre-formatted clipboard structures
  const copyCombinedPost = () => {
    if (!analysisResult) return;
    const combined = `🎯 ${analysisResult.title}\n\n📝 ${analysisResult.description}\n\n${analysisResult.hashtags.join(" ")}`;
    triggerCopy(combined, "combined");
  };

  if (view === "landing") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-purple-100 dark:selection:bg-purple-900 selection:text-purple-950 dark:selection:text-purple-100 flex flex-col justify-between relative overflow-hidden transition-colors duration-200">
        {/* Ambient background accent fields */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-150/45 dark:bg-purple-900/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-indigo-100/35 dark:bg-indigo-950/10 rounded-full blur-3xl -z-10 pointer-events-none" />

        <header className="py-6 px-4 max-w-7xl mx-auto w-full flex justify-between items-center bg-transparent">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500 bg-slate-200/50 dark:bg-slate-900 px-2.5 py-0.5 rounded-md font-sans">
              v1.2 Stable
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDark(!isDark)}
              type="button"
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-55 dark:hover:bg-slate-800 transition duration-150 cursor-pointer shadow-3xs"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-violet-600" />}
            </button>

            {currentUser && (
              <button
                onClick={handleLogout}
                className="text-xs font-bold text-slate-550 dark:text-slate-400 hover:text-red-650 dark:hover:text-rose-400 transition duration-152 flex items-center gap-1.5 font-sans cursor-pointer whitespace-nowrap"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            )}
          </div>
        </header>

        <main className="max-w-md w-full mx-auto px-6 py-12 flex-1 flex flex-col justify-center items-center z-10 w-full">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none p-8 sm:p-10 w-full text-center hover:shadow-2xl dark:hover:border-slate-700 hover:border-slate-300 transition-all duration-300">
            {/* Logo centerpiece */}
            <div className="flex justify-center mb-8">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-inner inline-block transition transform hover:rotate-2 duration-300">
                <Logo className="h-44 w-44" showText={false} />
              </div>
            </div>

            <h2 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white font-sans mb-3 text-center">
              AI POSTMASTER
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-10 font-sans leading-relaxed text-center">
              Automate high-converting SMM captions, hashtags, and structural layouts directly from your raw video reels using Gemini model scans.
            </p>

            <div className="space-y-4">
              {currentUser ? (
                <div className="space-y-3 animate-fade-in">
                  <div className="bg-purple-50 dark:bg-purple-950/25 rounded-2xl p-4 border border-purple-100 dark:border-purple-800/40">
                    <p className="text-[11px] uppercase font-bold text-purple-600 dark:text-purple-400 tracking-wider mb-1">
                      Authenticated Session
                    </p>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {currentUser.isAnonymous ? "Logged in as Guest" : currentUser.displayName || currentUser.email || "Active User"}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => setView("workspace")}
                    className="w-full py-4 bg-linear-to-r from-purple-700 to-indigo-650 hover:from-purple-850 hover:to-indigo-700 text-white font-bold text-sm rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 font-sans"
                  >
                    <span>Enter Workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    onClick={handleGoogleLogin}
                    className="w-full py-3.5 px-4 bg-white dark:bg-slate-805 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-205 border border-slate-250 dark:border-slate-705 hover:border-slate-300 dark:hover:border-slate-650 font-bold text-sm rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex items-center justify-center gap-3 font-sans"
                  >
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    <span>Continue with Google</span>
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      onClick={handleGuestLogin}
                      className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition cursor-pointer"
                    >
                      Or enter instantly in Guest Mode
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        <JSBridgeSetup />

        <footer className="border-t border-slate-200/60 dark:border-slate-830 bg-white dark:bg-slate-900 py-8 text-slate-400 dark:text-slate-500 text-center font-sans text-xs select-none">
          <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Logo className="h-6 w-6" showText={false} />
              <span className="font-extrabold text-[11px] tracking-wider text-slate-600 dark:text-slate-400">AI POSTMASTER</span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-550">© 2026 AI Postmaster. Secure, premium AI-powered social publisher.</p>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900 selection:text-indigo-900 dark:selection:text-indigo-100 transition-colors duration-200">
      {/* Premium Header */}
      <header className="border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-xs sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto pr-4 sm:pr-6 lg:pr-8 pl-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 w-full sm:h-[80px] h-auto">
          <div className="flex items-center gap-3">
            <div className="cursor-pointer flex items-center gap-3 group" onClick={() => setView("landing")}>
              <Logo showText={false} className="h-11 w-11 transform group-hover:scale-105 transition" />
              <div>
                <h1 className="text-[24px] leading-6 font-black tracking-tight bg-linear-to-r from-purple-800 via-purple-650 to-amber-600 dark:from-purple-400 dark:to-amber-400 bg-clip-text text-transparent font-sans">
                  AI Postmaster
                </h1>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold tracking-wider uppercase font-sans mt-0.5">
                  ← Back to landing
                </p>
              </div>
            </div>
          </div>
          
          {/* Authentic Identity Panel / Google Auth Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDark(!isDark)}
              type="button"
              className="p-2 rounded-xl bg-white dark:bg-slate-850 hover:bg-slate-55 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-750 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition duration-150 cursor-pointer shadow-3xs"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDark ? <Sun className="h-3.5 w-3.5 text-amber-500" /> : <Moon className="h-3.5 w-3.5 text-violet-600" />}
            </button>

             {currentUser ? (
               <div className="flex items-center gap-2.5 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                 {currentUser.isAnonymous ? (
                   <div className="h-7 w-7 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-[10px] uppercase shadow-xs">
                     G
                   </div>
                 ) : currentUser.photoURL ? (
                   <img
                     src={currentUser.photoURL}
                     alt={currentUser.displayName || "User"}
                     referrerPolicy="no-referrer"
                     className="h-7 w-7 rounded-full border border-purple-200 dark:border-purple-900"
                   />
                 ) : (
                   <div className="h-7 w-7 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                     {(currentUser.displayName || currentUser.email || "U").substring(0, 1).toUpperCase()}
                   </div>
                 )}
                 <div className="text-left">
                   <p className="text-[11px] font-bold text-purple-950 dark:text-purple-100 leading-3 max-w-[130px] truncate font-sans">
                     {currentUser.isAnonymous ? "Guest SMM Pro" : currentUser.displayName || "Authenticated User"}
                   </p>
                   <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium max-w-[130px] truncate font-sans">
                     {currentUser.isAnonymous ? "Guest Workspace" : currentUser.email}
                   </p>
                 </div>
                 <button
                   onClick={handleLogout}
                   type="button"
                   className="p-1.5 text-slate-400 hover:text-rose-605 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                   title="Sign Out"
                 >
                   <LogOut className="h-3.5 w-3.5" />
                 </button>
               </div>
             ) : (
               <button
                 onClick={handleGoogleLogin}
                 type="button"
                 className="flex items-center gap-1.5 px-4 py-2 bg-linear-to-r from-purple-700 to-indigo-650 hover:from-purple-850 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer font-sans"
               >
                 <LogIn className="h-3.5 w-3.5" />
                 Sign In with Google
               </button>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-[1019.4px] w-full mt-6 shadow-2xs transition-colors duration-200">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Input panel (Interactive Area) */}
          <section className="lg:col-span-5 flex flex-col gap-6" id="input-section">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h2 className="text-lg font-bold font-display text-purple-950 dark:text-purple-300 mb-4 flex items-center gap-2">
                <FileVideo className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Step 1: <span className="text-amber-600 dark:text-amber-400">Upload Video File</span>
              </h2>

              {/* Drag and Drop Zone */}
              {!file ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
                    dragOverRef.current
                      ? "border-purple-500 bg-purple-50/50 scale-[0.99]"
                      : "border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="h-12 w-12 rounded-full bg-purple-50 flex items-center justify-center mb-3">
                    <UploadCloud className="h-6 w-6 text-purple-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-purple-900 mb-1">
                    Drag and drop your video file
                  </h3>
                  <p className="text-xs text-slate-400 mb-3">
                    Supports .mp4 files up to 2GB
                  </p>
                  <button
                    type="button"
                    className="px-4 py-1.5 bg-purple-50 border border-[#edbe14] hover:border-amber-400 text-xs font-semibold text-purple-700 rounded-lg shadow-2xs hover:shadow-xs transition"
                  >
                    Browse Local System
                  </button>
                </div>
              ) : (
                <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-slate-50 relative group">
                  {videoUrl ? (
                    <div className="aspect-video w-full bg-black relative">
                      <video
                        src={videoUrl}
                        controls
                        className="w-full h-full object-contain"
                        preload="metadata"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video w-full flex items-center justify-center bg-slate-900 text-white">
                      <span className="text-xs">No preview available</span>
                    </div>
                  )}

                  <div className="p-4 flex items-center justify-between gap-3 border-t border-slate-200 bg-white">
                    <div className="overflow-hidden">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={handleRemoveFile}
                      type="button"
                      disabled={isAnalyzing}
                      className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                      title="Remove file"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{errorMessage}</p>
                    <p className="text-slate-500 mt-1">If this persists, check your Internet connection or check API keys in setting parameters.</p>
                  </div>
                </div>
              )}

              {saveSuccessMessage && (
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2.5">
                  <Check className="h-4 w-4 shrink-0 text-emerald-600 animate-bounce" />
                  <p className="font-semibold">{saveSuccessMessage}</p>
                </div>
              )}
            </div>

            {/* Step 2: Tone & Extra customization */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h2 className="text-lg font-bold font-display text-purple-950 dark:text-purple-300 mb-4 flex items-center gap-2">
                <Settings className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Step 2: <span className="text-amber-600 dark:text-amber-400">SEO Tone & Context</span>
              </h2>

              <label className="block text-xs font-bold uppercase tracking-wider text-purple-700/80 dark:text-purple-400 mb-2">
                Business Category & Content Tone
              </label>

              {/* Premium Tone Swapper Cards */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setTone("standard")}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    tone === "standard"
                      ? "border-purple-650 bg-purple-50/30 shadow-xs ring-1 ring-purple-100"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <Globe className={`h-4.5 w-4.5 mb-2 ${tone === "standard" ? "text-amber-500" : "text-slate-400"}`} />
                  <p className={`font-semibold text-xs ${tone === "standard" ? "text-purple-900" : "text-slate-900"}`}>Standard Viral</p>
                  <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">Catchy for TikTok & Instas</p>
                </button>

                <button
                  type="button"
                  onClick={() => setTone("wholesale")}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    tone === "wholesale"
                      ? "border-purple-650 bg-purple-50/30 shadow-xs ring-1 ring-purple-100"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <Settings className={`h-4.5 w-4.5 mb-2 ${tone === "wholesale" ? "text-amber-500" : "text-slate-400"}`} />
                  <p className={`font-semibold text-xs ${tone === "wholesale" ? "text-purple-900" : "text-slate-900"}`}>B2B & Wholesale</p>
                  <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">Textiles, logistics, materials</p>
                </button>

                <button
                  type="button"
                  onClick={() => setTone("real-estate")}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    tone === "real-estate"
                      ? "border-purple-650 bg-purple-50/30 shadow-xs ring-1 ring-purple-100"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <Building className={`h-4.5 w-4.5 mb-2 ${tone === "real-estate" ? "text-amber-500" : "text-slate-400"}`} />
                  <p className={`font-semibold text-xs ${tone === "real-estate" ? "text-purple-900" : "text-slate-900"}`}>Real Estate</p>
                  <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">Developments & estates</p>
                </button>

                <button
                  type="button"
                  onClick={() => setTone("culinary")}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    tone === "culinary"
                      ? "border-purple-650 bg-purple-50/30 shadow-xs ring-1 ring-purple-100"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <Utensils className={`h-4.5 w-4.5 mb-2 ${tone === "culinary" ? "text-amber-500" : "text-slate-400"}`} />
                  <p className={`font-semibold text-xs ${tone === "culinary" ? "text-purple-900" : "text-slate-900"}`}>Experiential Culinary</p>
                  <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">High-end dining & bars</p>
                </button>
              </div>

              {/* Extra context instructions */}
              <div className="mb-6">
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-700/80 mb-1.5">
                  Additional Details / <span className="text-amber-600">Target Audience</span> <span className="text-[10px] font-normal text-slate-400 font-sans tracking-tight capitalize">(Optional)</span>
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g.: Introduce our organic cotton materials, focus on European markets, or prompt to mention active discount code..."
                  rows={3}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 focus:outline-hidden resize-none placeholder-slate-400"
                />
              </div>

              {/* Big Action Submit */}
              <button
                type="button"
                disabled={!file || isAnalyzing}
                onClick={executeVideoAnalysis}
                className={`w-full py-3 px-4 rounded-xl font-bold text-sm tracking-tight flex items-center justify-center gap-2 cursor-pointer transition ${
                  !file
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-linear-to-r from-purple-700 via-purple-600 to-amber-500 hover:from-purple-800 hover:to-amber-600 text-white shadow-lg shadow-purple-100 transform hover:-translate-y-0.5 active:translate-y-0"
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    AI Analyzing Video...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analyze Video & Draft Social SMM
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Right Output panel (Simulation & Results) */}
          <section className="lg:col-span-7 flex flex-col gap-6" id="output-section">
            
            {/* If analyzing / Loading state displays */}
            {isAnalyzing && (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col items-center justify-center text-center py-16">
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-full border-4 border-purple-50 border-t-purple-600 animate-spin flex items-center justify-center"></div>
                  <Sparkles className="h-6 w-6 text-amber-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
                
                <h3 className="text-lg font-bold font-display text-purple-950 mb-2">
                  Multimodal Frame Analysis on <span className="text-amber-600">Cloud</span>
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
                  We are uploading the binary stream and employing Gemini's massive input context window to scan frames, spoken scripts, and tone indicators.
                </p>

                {/* Staggered progress display */}
                <div className="w-full max-w-md bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col gap-3.5 text-left">
                  {loadingSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="shrink-0 flex items-center justify-center">
                        {loadingStep > idx ? (
                          <div className="h-5.5 w-5.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        ) : loadingStep === idx ? (
                          <div className="h-5.5 w-5.5 rounded-full border border-purple-500 flex items-center justify-center">
                            <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
                          </div>
                        ) : (
                          <div className="h-5.5 w-5.5 rounded-full border border-slate-200 bg-white text-slate-300 flex items-center justify-center text-[10px] font-bold font-mono">
                            {idx + 1}
                          </div>
                        )}
                      </div>
                      <span className={`text-xs font-semibold ${loadingStep === idx ? "text-purple-700" : loadingStep > idx ? "text-slate-500 line-through decoration-slate-200" : "text-slate-400"}`}>
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* If no results and not loading placeholder */}
            {!isAnalyzing && !analysisResult && (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center py-20">
                <div className="h-16 w-16 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-amber-500 border border-purple-100/50">
                  <Sparkles className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold font-display text-purple-950 mb-2">
                  Ready for <span className="text-amber-600">Social Intelligence</span>
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  Upload an `.mp4` video on the left, customize your professional context or target audience, and trigger the AI agent to review the audio, visuals, and texts instantly.
                </p>
              </div>
            )}

            {/* Analysis report completed and loaded */}
            {!isAnalyzing && analysisResult && (
              <div className="flex flex-col gap-6 animate-fade-in">
                
                {/* Master Results Board */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="bg-slate-900 text-white py-4.5 px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400"></span>
                        <h2 className="text-sm font-bold tracking-wide uppercase text-slate-200">
                          SEO SMM Campaign Package
                        </h2>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 font-sans">
                        Generated with <span className="font-bold underline text-indigo-400">{tone.toUpperCase()}</span> Tone config
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pb-1 sm:pb-0">
                      <button
                        onClick={copyCombinedPost}
                        type="button"
                        className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 transition text-[11px] font-bold text-white rounded-lg flex items-center gap-1.5 shadow-sm shadow-indigo-700 cursor-pointer"
                      >
                        {copiedStates["combined"] ? (
                          <>
                            <Check className="h-3 w-3" />
                            Post Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copy Combined Post
                          </>
                        )}
                      </button>

                      {currentUser ? (
                        <button
                          onClick={saveCurrentCampaign}
                          type="button"
                          disabled={isSaving}
                          className="py-1.5 px-3 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-700/50 transition text-[11px] font-bold text-white rounded-lg flex items-center gap-1.5 shadow-sm shadow-amber-700 cursor-pointer"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="h-3 w-3" />
                              Save to SMM Portfolio
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={handleGoogleLogin}
                          type="button"
                          className="py-1.5 px-3 bg-slate-850 hover:bg-slate-800 transition text-[11px] font-bold text-slate-300 rounded-lg flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                          title="Connect to save SMM campaigns"
                        >
                          <LogIn className="h-3 w-3 text-amber-500" />
                          Sign-in to Save
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Primary Outputs Tabs/Details */}
                  <div className="p-6 divide-y divide-slate-100 flex flex-col gap-5">
                    
                    {/* Result 1: Optimized Title */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display">
                          Clickable Title Hook
                        </h3>
                        <button
                          onClick={() => triggerCopy(analysisResult.title, "title")}
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold bg-indigo-50/50 hover:bg-indigo-50 py-1 px-2.5 rounded-md transition cursor-pointer"
                        >
                          {copiedStates["title"] ? (
                            <>
                              <Check className="h-3 w-3" />
                              Copied Title
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-base sm:text-lg font-bold font-display tracking-tight text-slate-900 leading-snug">
                        {analysisResult.title}
                      </p>
                    </div>

                    {/* Result 2: Description Content */}
                    <div className="pt-5">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display">
                          High-Converting Post Description
                        </h3>
                        <button
                          onClick={() => triggerCopy(analysisResult.description, "desc")}
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold bg-indigo-50/50 hover:bg-indigo-50 py-1 px-2.5 rounded-md transition cursor-pointer"
                        >
                          {copiedStates["desc"] ? (
                            <>
                              <Check className="h-3 w-3" />
                              Copied Desc
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              Copy Caption
                            </>
                          )}
                        </button>
                      </div>
                      <div className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                        {analysisResult.description}
                      </div>
                    </div>

                    {/* Result 3: Hashtags cloud */}
                    <div className="pt-5">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display">
                          Trending SMM Hashtags ({analysisResult.hashtags.length})
                        </h3>
                        <button
                          onClick={() => triggerCopy(analysisResult.hashtags.join(" "), "tags")}
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold bg-indigo-50/50 hover:bg-indigo-50 py-1 px-2.5 rounded-md transition cursor-pointer"
                        >
                          {copiedStates["tags"] ? (
                            <>
                              <Check className="h-3 w-3" />
                              Copied Tags
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              Copy All Tags
                            </>
                          )}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {analysisResult.hashtags.map((tag, idx) => (
                          <span
                            key={idx}
                            onClick={() => triggerCopy(tag, `tag-${idx}`)}
                            className="inline-flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200/80 active:bg-slate-200 text-slate-600 hover:text-slate-800 text-xs px-2.5 py-1 rounded-md font-mono transition"
                            title="Click to copy single hashtag"
                          >
                            {copiedStates[`tag-${idx}`] ? (
                              <Check className="h-2.5 w-2.5 text-indigo-600 shrink-0" />
                            ) : (
                              <span className="text-indigo-400 font-bold font-sans shrink-0">#</span>
                            )}
                            {tag.replace(/^#/, "")}
                          </span>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Sub-widget: Social Feeds Live Mockup Container */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4 mb-4 pb-2 border-b border-slate-150">
                    <div>
                      <h3 className="text-sm font-bold font-display text-slate-900">
                        Interactive Social Feeds Previewer
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        See how generated draft layers look inside authentic layouts.
                      </p>
                    </div>

                    {/* Platform Selector buttons */}
                    <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
                      <button
                        onClick={() => setActivePreviewTab("youtube")}
                        type="button"
                        className={`px-3 py-1 text-[11px] font-bold rounded-md flex items-center gap-1 transition ${
                          activePreviewTab === "youtube" ? "bg-red-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-700"
                        }`}
                        id="yt-tab-button"
                      >
                        <Youtube className="h-3 w-3" />
                        YouTube Shorts
                      </button>
                      <button
                        onClick={() => setActivePreviewTab("instagram")}
                        type="button"
                        className={`px-3 py-1 text-[11px] font-bold rounded-md flex items-center gap-1 transition ${
                          activePreviewTab === "instagram" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        <Instagram className="h-3 w-3" />
                        Insta Reels
                      </button>
                      <button
                        onClick={() => setActivePreviewTab("facebook")}
                        type="button"
                        className={`px-3 py-1 text-[11px] font-bold rounded-md flex items-center gap-1 transition ${
                          activePreviewTab === "facebook" ? "bg-blue-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-700"
                        }`}
                        id="fb-tab-button"
                      >
                        <Facebook className="h-3 w-3" />
                        Facebook Reels
                      </button>
                    </div>
                  </div>

                  {/* Tab contents (Feeds mock simulation) */}
                  <div className="flex justify-center bg-slate-900/5 p-4 sm:p-8 rounded-xl border border-slate-100 relative">
                    
                    {/* YouTube Shorts Mock */}
                    {activePreviewTab === "youtube" && (
                      <div className="w-full max-w-[280px] aspect-[9/16] bg-slate-950 rounded-3xl shadow-2xl relative overflow-hidden text-left text-white border-6 border-slate-800" id="youtube-mockup-screen">
                        {/* Video Background */}
                        {videoUrl ? (
                          <video src={videoUrl} className="absolute inset-0 w-full h-full object-cover opacity-60" muted loop autoPlay />
                        ) : (
                          <div className="absolute inset-0 bg-red-950/20 flex items-center justify-center">
                            <span className="text-[11px] text-slate-400">YouTube Video Track</span>
                          </div>
                        )}

                        {/* Top bar with YouTube Shorts label */}
                        <div className="absolute top-4 left-3 right-3 flex items-center justify-between text-xs font-bold tracking-wider text-white select-none z-10">
                          <span className="flex items-center gap-1 bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-full text-[10px]">
                            <span className="h-1.5 w-1.5 bg-red-600 rounded-full animate-ping"></span>
                            SHORTS
                          </span>
                          <span className="text-[10px] text-white/80">⚡ Live View</span>
                        </div>

                        {/* Bottom Metadata details */}
                        <div className="absolute bottom-4 left-3 right-3 z-10 flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-[8px] border border-white/20">
                              YT
                            </div>
                            <span className="text-[11px] font-bold tracking-tight">@viral_shorts</span>
                            <span className="text-[9px] bg-red-600 hover:bg-red-700 font-bold px-2 py-0.5 rounded-full cursor-pointer transition select-none">
                              Subscribe
                            </span>
                          </div>

                          <div className="bg-black/45 backdrop-blur-xs p-2.5 rounded-xl border border-white/10 text-[10px]/normal max-h-36 overflow-y-auto no-scrollbar scroll-smooth animate-fade-in">
                            <p className="font-bold text-[11px] mb-1 text-red-400 leading-snug">{analysisResult.title}</p>
                            <p className="text-slate-250 whitespace-pre-wrap">{analysisResult.description}</p>
                            <p className="text-red-300 font-semibold mt-1">{analysisResult.hashtags.join(" ")}</p>
                          </div>
                        </div>

                        {/* YouTube reaction buttons on right sidebar */}
                        <div className="absolute bottom-28 right-2 flex flex-col items-center gap-4 text-white z-10 select-none">
                          <div className="flex flex-col items-center">
                            <div className="h-8 w-8 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center backdrop-blur-xs transition cursor-pointer text-xs">👍</div>
                            <span className="text-[8px] font-bold mt-0.5">84.2K</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-8 w-8 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center backdrop-blur-xs transition cursor-pointer text-xs">👎</div>
                            <span className="text-[8px] font-bold mt-0.5">Dislike</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-8 w-8 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center backdrop-blur-xs transition cursor-pointer text-xs">💬</div>
                            <span className="text-[8px] font-bold mt-0.5">1.5K</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-8 w-8 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center backdrop-blur-xs transition cursor-pointer text-xs">✈️</div>
                            <span className="text-[8px] font-bold mt-0.5">Share</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Instagram/Reel Mockup */}
                    {activePreviewTab === "instagram" && (
                      <div className="w-full max-w-[280px] aspect-[9/16] bg-black rounded-3xl shadow-2xl relative overflow-hidden text-left text-white border-6 border-slate-800">
                        {/* Video Background */}
                        {videoUrl ? (
                          <video src={videoUrl} className="absolute inset-0 w-full h-full object-cover opacity-60" muted loop autoPlay />
                        ) : (
                          <div className="absolute inset-0 bg-linear-to-b from-indigo-950/70 to-slate-900 flex items-center justify-center">
                            <span className="text-[11px] text-indigo-200/50">Simulated Playback</span>
                          </div>
                        )}

                        {/* Instagram overlay details */}
                        <div className="absolute bottom-4 left-3 right-3 flex flex-col justify-end z-10 select-none">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="h-6 w-6 rounded-full bg-violet-600 text-white border border-white/60 flex items-center justify-center font-bold text-[9px]">
                              IG
                            </div>
                            <span className="text-[11px] font-bold tracking-tight">creator_studio</span>
                            <span className="text-[9px] bg-white/25 border border-white/10 px-1 py-0.5 rounded-sm font-semibold">Follow</span>
                          </div>

                          <div className="bg-black/35 backdrop-blur-xs p-2.5 rounded-lg border border-white/10 text-[10px]/normal max-h-36 overflow-y-auto no-scrollbar scroll-smooth">
                            <p className="font-bold text-[11px] mb-1 text-yellow-300">{analysisResult.title}</p>
                            <p className="text-slate-200 whitespace-pre-wrap">{analysisResult.description}</p>
                            <p className="text-violet-300 font-semibold mt-1.5">{analysisResult.hashtags.join(" ")}</p>
                          </div>
                        </div>

                        {/* Heart and comment icons mock on IG */}
                        <div className="absolute bottom-28 right-2 flex flex-col items-center gap-4.5 text-white/90">
                          <div className="flex flex-col items-center">
                            <div className="h-8 w-8 rounded-full bg-black/25 flex items-center justify-center backdrop-blur-xs">❤️</div>
                            <span className="text-[8px] font-semibold mt-0.5">14.1K</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-8 w-8 rounded-full bg-black/25 flex items-center justify-center backdrop-blur-xs">💬</div>
                            <span className="text-[8px] font-semibold mt-0.5">382</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-8 w-8 rounded-full bg-black/25 flex items-center justify-center backdrop-blur-xs">✈️</div>
                            <span className="text-[8px] font-semibold mt-0.5">Share</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Facebook Reels Mock */}
                    {activePreviewTab === "facebook" && (
                      <div className="w-full max-w-[280px] aspect-[9/16] bg-slate-950 rounded-3xl shadow-2xl relative overflow-hidden text-left text-white border-6 border-slate-800" id="facebook-mockup-screen">
                        {/* Video Background */}
                        {videoUrl ? (
                          <video src={videoUrl} className="absolute inset-0 w-full h-full object-cover opacity-60" muted loop autoPlay />
                        ) : (
                          <div className="absolute inset-0 bg-blue-950/20 flex items-center justify-center">
                            <span className="text-[11px] text-slate-450">Facebook Reel Player</span>
                          </div>
                        )}

                        {/* Top bar */}
                        <div className="absolute top-4 left-3 right-3 flex justify-between items-center text-xs text-white/95 font-semibold z-10 select-none">
                          <span className="bg-blue-600/90 hover:bg-blue-600 backdrop-blur-xs px-2.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider">Reels</span>
                          <span className="text-[9px] text-white/60">Facebook Watch</span>
                        </div>

                        {/* Bottom metadata overlay */}
                        <div className="absolute bottom-4 left-3 right-3 z-10">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[9px] border border-white/20">
                              FB
                            </div>
                            <span className="text-[11px] font-bold">SMM_Strategist</span>
                            <span className="text-[9px] bg-blue-600 border border-blue-500 py-0.5 px-2 rounded-md font-bold transition hover:bg-blue-700 cursor-pointer select-none">
                              Follow
                            </span>
                          </div>

                          <div className="bg-slate-900/80 backdrop-blur-xs p-2.5 rounded-xl border border-slate-800 text-[10px]/relaxed text-slate-100 max-h-32 overflow-y-auto no-scrollbar">
                            <p className="font-bold text-[10px] text-blue-400 mb-1 leading-snug">{analysisResult.title}</p>
                            <p className="whitespace-pre-wrap">{analysisResult.description}</p>
                            <p className="text-blue-300 font-mono mt-1">{analysisResult.hashtags.join(" ")}</p>
                          </div>
                        </div>

                        {/* Action buttons list on sidebar */}
                        <div className="absolute bottom-28 right-2 flex flex-col items-center gap-4 text-white z-10 select-none">
                          <div className="flex flex-col items-center">
                            <div className="h-8 w-8 rounded-full bg-black/25 flex items-center justify-center backdrop-blur-xs cursor-pointer text-xs">👍</div>
                            <span className="text-[8px] font-semibold mt-0.5">3.2K</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-8 w-8 rounded-full bg-black/25 flex items-center justify-center backdrop-blur-xs cursor-pointer text-xs">💬</div>
                            <span className="text-[8px] font-semibold mt-0.5">142</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-8 w-8 rounded-full bg-black/25 flex items-center justify-center backdrop-blur-xs cursor-pointer text-xs">➡️</div>
                            <span className="text-[8px] font-semibold mt-0.5">Share</span>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Reset analysis button */}
                  <div className="mt-4 flex items-center justify-center border-t border-slate-100 pt-4">
                    <button
                      onClick={handleRemoveFile}
                      type="button"
                      className="inline-flex items-center gap-1.5 py-1.5 px-4 text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset to Analyse Another Video
                    </button>
                  </div>
                </div>

              </div>
            )}

          </section>

        </div>

        {/* SMM Saved Campaign History/Portfolio */}
        <div className="mt-12 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-left">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 border border-purple-100">
                <FolderHeart className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold font-display text-slate-900 leading-snug">
                  My Saved SMM Campaign Portfolio
                </h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">
                  Track, load, and manage your historical video draft campaigns secured in Cloud Firestore.
                </p>
              </div>
            </div>
            
            {currentUser && savedCampaigns.length > 0 && (
              <span className="text-xs bg-slate-150 font-bold px-2.5 py-1 rounded-full text-slate-700 font-mono self-start sm:self-center">
                {savedCampaigns.length} Saved {savedCampaigns.length === 1 ? "Draft" : "Drafts"}
              </span>
            )}
          </div>

          {!currentUser ? (
            <div className="py-10 text-center max-w-md mx-auto">
              <LogIn className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-800 mb-1 font-sans">Campaign History Locked</h4>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed font-sans">
                Sign in with Google to sync SMM campaign drafts permanently, or activate Guest mode to save drafts on a temp cloud session.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
                <button
                  onClick={handleGoogleLogin}
                  type="button"
                  className="w-full sm:w-auto px-5 py-2.5 bg-purple-650 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs hover:shadow-md transition-all cursor-pointer font-sans"
                >
                  Sign In with Google
                </button>
                <button
                  onClick={handleGuestLogin}
                  type="button"
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer font-sans"
                >
                  Guest Instant Log-In
                </button>
              </div>
            </div>
          ) : isLoadingSaved ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
              <p className="text-xs text-slate-400 font-medium font-sans">Retrieving saved campaigns from Cloud Firestore...</p>
            </div>
          ) : savedCampaigns.length === 0 ? (
            <div className="py-12 text-center max-w-sm mx-auto">
              <History className="h-8 w-8 text-slate-300 mx-auto mb-3" />
              <h4 className="text-xs font-bold text-slate-700 mb-1 font-sans">Your Portfolio is Empty</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                Perform an AI video analysis, click "Save to SMM Portfolio", and keep your high-converting content drafts safe.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedCampaigns.map((camp) => (
                <div
                  key={camp.id}
                  className="p-4 border border-slate-150 rounded-xl hover:border-purple-300 hover:shadow-xs transition bg-slate-50/50 flex flex-col justify-between gap-4"
                >
                  <div className="text-left">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md font-bold uppercase font-sans">
                        {camp.tone}
                      </span>
                      <span className="text-[9px] text-slate-400 font-sans">
                        {camp.createdAt?.seconds 
                          ? new Date(camp.createdAt.seconds * 1000).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            }) 
                          : "Just now"}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 tracking-tight line-clamp-1 mb-1 font-sans" title={camp.title}>
                      {camp.title}
                    </h4>

                    {camp.fileName && (
                      <p className="text-[10px] text-indigo-600 font-semibold mb-2 truncate font-sans">
                        🎥 {camp.fileName}
                      </p>
                    )}

                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3 font-sans">
                      {camp.description}
                    </p>

                    <div className="flex flex-wrap gap-1 max-h-12 overflow-hidden">
                      {camp.hashtags.slice(0, 5).map((t, i) => (
                        <span key={i} className="text-[9px] bg-white border border-slate-200 text-slate-500 py-0.5 px-1.5 rounded-sm font-sans">
                          {t.startsWith("#") ? t : `#${t}`}
                        </span>
                      ))}
                      {camp.hashtags.length > 5 && (
                        <span className="text-[9px] font-bold text-slate-400 py-0.5 px-1 font-sans">
                          +{camp.hashtags.length - 5}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-t border-slate-100 pt-3 mt-1">
                    <button
                      onClick={() => loadSavedCampaign(camp)}
                      type="button"
                      className="flex-1 py-1.5 px-3 bg-white hover:bg-purple-50 text-purple-700 text-xs font-semibold rounded-lg border border-purple-250 hover:border-purple-300 transition-all cursor-pointer text-center font-sans shadow-2xs"
                    >
                      Retrieve to Board
                    </button>
                    <button
                      onClick={() => deleteSavedCampaign(camp.id)}
                      type="button"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete draft from history"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="bg-slate-50 dark:bg-slate-900 border-t border-slate-205 dark:border-slate-800 py-6 mt-16 text-slate-400 dark:text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
          <p>© 2026 <span className="text-purple-900 dark:text-purple-400 font-bold">AI Postmaster</span>. Powered by <span className="text-amber-600 font-semibold">Mr. S. Banerjee</span></p>
        </div>
      </footer>

      {showAuthBlockedModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 transition-all text-left" id="auth-blocked-modal">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-150 relative animate-in fade-in duration-200">
            <button
              type="button"
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg text-sm cursor-pointer"
              onClick={() => setShowAuthBlockedModal(false)}
            >
              ✕
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold font-sans text-slate-900">
                Sign-In Flow Restricted
              </h3>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed mb-4 font-sans">
              Iframe cross-origin restrictions in your browser prevented the Google Sign-In popup from completing (Error: <span className="font-mono text-rose-600 bg-rose-50 px-1 py-0.5 rounded">auth/popup-closed-by-user</span>).
            </p>
            
            <p className="text-xs text-slate-500 leading-relaxed mb-6 font-sans">
              You can open the workspace in a new tab for Google Authentication, or use our instant **Guest Mode** fallback, which activates real Firebase Authentication immediately without popup windows.
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleGuestLogin}
                type="button"
                className="w-full py-2.5 px-4 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-xs active:translate-y-0 transition-all cursor-pointer font-sans text-center flex items-center justify-center gap-2"
              >
                <Sparkles className="h-4 w-4 text-amber-400 animate-pulse" />
                Sign In as Guest (Recommended)
              </button>
              
              <a
                href={window.location.href}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer font-sans text-center block border border-slate-200"
              >
                Open workspace in New Tab
              </a>
              
              <button
                onClick={() => setShowAuthBlockedModal(false)}
                type="button"
                className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl text-xs font-semibold font-sans text-center border border-slate-250 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function JSBridgeSetup() {
  useEffect(() => {
    const playDemo = (demoType: string) => {
      const titleEl = document.getElementById("sim-title");
      const descEl = document.getElementById("sim-desc");
      const hashEl = document.getElementById("sim-hashes");
      if (!titleEl || !descEl || !hashEl) return;

      const demos: Record<string, { title: string; desc: string; hashes: string[] }> = {
        "real-estate": {
          title: "🔑 Modern Masterpiece Tour: $2,450,000 Luxury Estate Reveal",
          desc: "Step inside premium contemporary elegance! ✨ Located in the scenic heart of Beverly Hills, this signature architectural layout features custom floor-to-ceiling glass paneling, a temperature-controlled infinity pool, and a professional culinary kitchen. This is luxury defined.\n\nSchedule a private VIP tour today or browse all features in physical bio link. 👇",
          hashes: ["#LuxuryRealEstate", "#BeverlyHillsMansion", "#ModernArchitecture", "#DreamHome", "#EstateTour", "#HomeDesign"]
        },
        "culinary": {
          title: "🍳 The Perfect Italian Risotto: Master-Chef Seared Scallop Recipe",
          desc: "Save this recipe for dinner tonight! 🇮🇹 Chef Somnath takes you step-by-step through the traditional technique to cook velvety Arborio rice in saffron bouillon, topped with skillet-seared jumbo scallops and microgreens. The key is in the continuous heat & gentle broth integration.\n\nFull written recipe with ingredient metrics is in the comments! 👇",
          hashes: ["#RisottoRecipe", "#GourmetCooking", "#ItalianCuisine", "#FoodieReel", "#MasterChefSecrets", "#RisottoPerfect"]
        },
        "standard": {
          title: "💻 3 AI Productivity Hacks that Saved Me 14 Hours This Week",
          desc: "Are you still copying text manually? Stop losing time. 🚀\n\nIn this short, we analyze the 3 essential automated pipelines using standard API wrappers to summarize meeting recordings, create smart client follow-ups, and organize campaign drafts with Cloud databases.\n\nSave this video to audit your workflow, and hit follow for daily AI tips! 🔥",
          hashes: ["#ProductivityHacks", "#AICoderWorkspace", "#WorkflowOptimization", "#AutomateTask", "#TechShorts", "#TimeSaver"]
        }
      };

      const selected = demos[demoType];
      if (selected) {
        titleEl.textContent = selected.title;
        descEl.textContent = selected.desc;
        hashEl.innerHTML = selected.hashes
          .map(t => `<span class="bg-slate-800 text-purple-300 py-0.5 px-2 rounded-md font-sans">${t}</span>`)
          .join("");
      }
    };

    window.playDemo = playDemo;
    setTimeout(() => playDemo("real-estate"), 100);
  }, []);

  return null;
}

declare global {
  interface Window {
    playDemo?: (demoType: string) => void;
  }
}
