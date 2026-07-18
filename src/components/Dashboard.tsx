import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { 
  Film, LogOut, Play, Sparkles, Send, RefreshCw, 
  Download, AlertTriangle, CheckCircle2, Cpu, HelpCircle, Eye
} from 'lucide-react';

// Preset prompts to help users get started
const PRESET_PROMPTS = [
  "A majestic cinematic drone shot of ancient misty ruins atop a green mountain ridge, sunset light, 8k",
  "Cyberpunk wet streets at night under flashing neon signs, camera panning low to the ground, unreal engine",
  "A gorgeous macro close-up of a glass sculpture morphing and dissolving under shifting psychedelic lights",
  "Hyper-realistic slow motion ripple of clean water in a dark room under a single beam of dramatic gold light"
];

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [processing, setProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successVideoUrl, setSuccessVideoUrl] = useState<string | null>(null);
  const [sandboxMode, setSandboxMode] = useState(!isSupabaseConfigured); 
  const [pollCount, setPollCount] = useState(0);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clear intervals on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Preset prompt handler
  const handleApplyPreset = (preset: string) => {
    if (!processing) {
      setPrompt(preset);
    }
  };

  // Generate Video Core Action
  const handleGenerateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setProcessing(true);
    setErrorMsg(null);
    setSuccessVideoUrl(null);
    setPollCount(0);
    setStatusText('Initiating generation queue on GPU cluster...');

    if (sandboxMode) {
      // --- SANDBOX DEMO WORKFLOW ---
      // Simulates the identical state machine and timing without requiring 
      // Supabase Edge Functions or FastAPI instances to be deployed first.
      console.log('Sandbox Mode Active: Simulating generation process...');
      const mockJobId = `job_${Math.random().toString(36).substring(2, 9)}`;
      setJobId(mockJobId);
      
      // Start polling simulation
      let currentProgressTick = 0;
      pollIntervalRef.current = setInterval(() => {
        currentProgressTick += 1;
        setPollCount(prev => prev + 1);

        if (currentProgressTick === 1) {
          setStatusText('Warm start sequence triggered... Allocating VRAM (12.2 GB / 24 GB)');
        } else if (currentProgressTick === 2) {
          setStatusText('Stable Diffusion model loaded. Rendering frame 12/64... [Speed: 4.8 it/s]');
        } else if (currentProgressTick === 3) {
          setStatusText('Stable Diffusion rendering frame 38/64... [Speed: 4.9 it/s]');
        } else if (currentProgressTick === 4) {
          setStatusText('Rendering frame 60/64... Synthesis of temporal motion maps in progress.');
        } else if (currentProgressTick === 5) {
          setStatusText('Compiling raw frames to H.264 MP4 wrapper... Adjusting framerate to 24fps');
        } else if (currentProgressTick >= 6) {
          // Complete simulation
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          
          // Provide a stunning royalty-free loop video for mockup purposes
          const sampleVideos = [
            'https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1611-large.mp4',
            'https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-glow-41913-large.mp4',
            'https://assets.mixkit.co/videos/preview/mixkit-flowing-neon-particles-and-lines-41914-large.mp4'
          ];
          const selectedVideo = sampleVideos[Math.floor(Math.random() * sampleVideos.length)];
          
          setSuccessVideoUrl(selectedVideo);
          setProcessing(false);
          setStatusText('Completed successfully!');
        }
      }, 5000);

    } else {
      // --- REAL SUPABASE EDGE FUNCTION INTEGRATION ---
      try {
        /* 
          TIE IN POINT #1: Invoking 'generate-video' Supabase Edge Function.
          This will trigger your Supabase Edge Function which proxies the request 
          to your FastAPI backend running Stable Diffusion/AnimateDiff/SVD on the GPU.
        */
        const { data, error } = await supabase.functions.invoke('generate-video', {
          body: { prompt: prompt.trim() },
        });

        if (error) {
          throw new Error(error.message || 'Error returned from video generation service.');
        }

        // Suppose your Edge function returns: { success: true, jobId: "some-uuid" }
        const generatedJobId = data?.jobId || `job_${Math.random().toString(36).substring(2, 9)}`;
        setJobId(generatedJobId);
        setStatusText('Request queued successfully. Initializing hardware monitors...');

        // Start real polling mechanism
        startPolling(generatedJobId);

      } catch (err: any) {
        console.error('Edge Function Error:', err);
        setErrorMsg(err.message || 'Could not connect to the remote GPU render node.');
        setProcessing(false);
      }
    }
  };

  // Real Polling Engine
  const startPolling = (targetJobId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      setPollCount(prev => prev + 1);
      
      try {
        /*
          TIE IN POINT #2: Check status of current job.
          The check-status function communicates with your database or FastAPI 
          backend to determine if the frames are compiled and uploaded to storage.
        */
        const { data, error } = await supabase.functions.invoke('check-status', {
          body: { jobId: targetJobId }
        });

        if (error) {
          // Don't crash immediately on a transient network error, just update text
          console.warn('Transient polling error:', error);
          setStatusText('Awaiting cluster response... [Handshaking network]');
          return;
        }

        /*
          EXPECTED CONTRACT:
          Your check-status Edge Function should return something like:
          { 
             status: 'pending' | 'processing' | 'completed' | 'failed',
             progressLogs?: 'GPU is rendering...',
             videoUrl?: 'https://.../your-bucket/video.mp4'
          }
        */
        const status = data?.status || 'processing';
        const logs = data?.progressLogs || 'GPU is rendering frames...';
        const finalUrl = data?.videoUrl;

        setStatusText(logs);

        if (status === 'completed' && finalUrl) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setSuccessVideoUrl(finalUrl);
          setProcessing(false);
        } else if (status === 'failed') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setErrorMsg(data?.error || 'GPU frame-rendering script exited with an error.');
          setProcessing(false);
        }

      } catch (err: any) {
        console.error('Polling error:', err);
        // We will keep polling in case of minor connection issues unless there is a fatal error
      }
    }, 5000); // Polling every 5 seconds as requested
  };

  // Reset function to generate another video
  const handleGenerateAnother = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    setSuccessVideoUrl(null);
    setJobId(null);
    setPrompt('');
    setErrorMsg(null);
    setProcessing(false);
    setStatusText('');
    setPollCount(0);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-[#EDEDEF] font-sans flex flex-col">
      {/* Dynamic Background Accents */}
      <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-purple-950/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-0 w-[350px] h-[350px] bg-indigo-950/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Modern Header Navigation */}
      <header className="sticky top-0 z-50 bg-[#0A0A0C]/85 backdrop-blur-md border-b border-[#1E1E24] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-purple-600 to-indigo-600 p-2 rounded-xl text-white shadow-md shadow-purple-900/15">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight leading-none">AI Video Studio</h1>
              <span className="text-[10px] text-purple-400 font-mono">v1.2 // Stable Diffusion</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Environment Toggle Switch */}
            <div className="hidden sm:flex items-center gap-2 bg-[#141418] border border-[#24242B] rounded-xl px-3 py-1.5 text-xs" title={!isSupabaseConfigured ? "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to unlock real integration" : "Toggle simulation / real API mode"}>
              <span className="text-gray-400">Sandbox Mode</span>
              <button
                type="button"
                onClick={() => {
                  if (isSupabaseConfigured) {
                    setSandboxMode(!sandboxMode);
                  } else {
                    alert("Supabase keys are currently not configured in settings. Add your Supabase credentials in .env or the Secrets panel to unlock live API connections!");
                  }
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${sandboxMode ? 'bg-purple-600' : 'bg-gray-700'}`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${sandboxMode ? 'translate-x-4' : 'translate-x-0'}`}
                />
              </button>
              <span className="font-semibold text-[10px] text-gray-300">
                {sandboxMode ? '(Simulated Logs)' : '(Live Edge Fn)'}
              </span>
            </div>

            {/* User Profile and Signout */}
            <div className="flex items-center gap-3 bg-[#121216] px-3 py-1.5 rounded-xl border border-[#1E1E24]">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-gray-300 font-mono max-w-[150px] truncate">
                {user?.email || 'akhiakmtr@gmail.com'}
              </span>
            </div>

            <button
              id="logout-btn"
              onClick={signOut}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#1F1F24] hover:bg-red-950/20 hover:text-red-400 border border-[#2C2C35] hover:border-red-900/50 rounded-xl text-xs text-gray-300 transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Workspace */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 z-10">
        
        {/* Left Column: Form & Prompt Input */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-[#111114] border border-[#212128] rounded-2xl p-6 shadow-xl shadow-black/20">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-semibold tracking-wider text-gray-200 uppercase">
                Configure Generation
              </h2>
            </div>

            <form onSubmit={handleGenerateVideo} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2" htmlFor="prompt-input">
                  CRAFT A DETAILED PROMPT
                </label>
                <textarea
                  id="prompt-input"
                  rows={6}
                  placeholder="Describe your cinematic video scene, including lighting, details, camera direction, and speed..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={processing}
                  className="w-full bg-[#17171C] border border-[#2D2D38] focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 rounded-xl p-4 text-sm text-white placeholder-gray-500 focus:outline-none transition-all resize-none leading-relaxed"
                />
                <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                  <span>Describe action / movement for better results</span>
                  <span className={`${prompt.length > 300 ? 'text-purple-400' : ''}`}>
                    {prompt.length} chars
                  </span>
                </div>
              </div>

              {/* Presets List */}
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-2">
                  SAMPLE PRESETS
                </span>
                <div className="space-y-2">
                  {PRESET_PROMPTS.map((preset, index) => (
                    <button
                      key={index}
                      type="button"
                      disabled={processing}
                      onClick={() => handleApplyPreset(preset)}
                      className="w-full text-left p-2.5 bg-[#17171C] hover:bg-[#202028] border border-[#24242F] hover:border-purple-900/40 rounded-xl text-xs text-gray-300 transition-all truncate block cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <button
                id="generate-btn"
                type="submit"
                disabled={processing || !prompt.trim()}
                className="w-full py-4 px-5 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/50 shadow-lg shadow-purple-950/20 active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{processing ? 'Queuing GPU Instance...' : 'Generate Video'}</span>
              </button>
            </form>
          </div>

          {/* Quick Stats Node Information */}
          <div className="bg-[#111114]/40 border border-[#212128]/50 rounded-2xl p-5 text-xs text-gray-400 space-y-3">
            <h3 className="font-semibold text-gray-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              FastAPI GPU Connection info
            </h3>
            <p className="leading-relaxed">
              Your prompts are sent directly to a private FastAPI server. Edge functions handles queue schedules, storing finalized .mp4 render files in a secure private Supabase storage bucket bucket.
            </p>
            <div className="p-2.5 bg-black/40 rounded-lg border border-white/5 space-y-1 font-mono text-[10px]">
              <div className="flex justify-between">
                <span>API Node:</span>
                <span className="text-purple-400">StableDiffusion-v2.1-SVD</span>
              </div>
              <div className="flex justify-between">
                <span>VRAM Allocation:</span>
                <span className="text-emerald-400">Active (Automatic Scaler)</span>
              </div>
              <div className="flex justify-between">
                <span>Output Format:</span>
                <span className="text-gray-300">H.264 / 24 FPS / 1024x576</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Stage (Rendering state, video player) */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="bg-[#111114] border border-[#212128] rounded-2xl p-6 flex-grow flex flex-col justify-center min-h-[450px] shadow-xl shadow-black/20">
            
            {/* STATE 1: IDLE STATE */}
            {!processing && !successVideoUrl && !errorMsg && (
              <div className="text-center py-12 px-6 max-w-md mx-auto my-auto flex flex-col items-center">
                <div className="w-16 h-16 bg-[#16161B] border border-[#2E2E39] rounded-2xl flex items-center justify-center text-purple-400 mb-6 shadow-inner shadow-purple-500/5">
                  <Play className="w-6 h-6 fill-purple-400 text-purple-400 ml-1" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Ready to Render</h3>
                <p className="text-sm text-gray-400 leading-relaxed mb-6">
                  Select a preset on the left or write a custom detailed prompt, then click <strong className="text-purple-400">Generate Video</strong> to trigger the GPU rendering process.
                </p>
                <div className="text-xs text-purple-300/60 bg-purple-950/20 px-3 py-1.5 rounded-full border border-purple-900/30 font-mono">
                  No active generation queue
                </div>
              </div>
            )}

            {/* STATE 2: PROCESSING STATE */}
            {processing && (
              <div className="my-auto py-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto">
                {/* Custom Mesmerizing Spin Rings */}
                <div className="relative w-24 h-24 mb-8">
                  {/* Outer Pulsing Glow */}
                  <div className="absolute inset-0 bg-purple-600/20 rounded-full blur-xl animate-pulse" />
                  
                  {/* Spinning Ring 1 */}
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-500 border-b-purple-500 animate-spin" />
                  
                  {/* Reverse Spinning Ring 2 */}
                  <div className="absolute inset-2 rounded-full border border-transparent border-l-indigo-400 border-r-indigo-400 animate-spin [animation-duration:3s]" />
                  
                  {/* Core Status Symbol */}
                  <div className="absolute inset-4 rounded-full bg-[#18181D] border border-[#2A2A33] flex items-center justify-center">
                    <Cpu className="w-6 h-6 text-purple-400 animate-pulse" />
                  </div>
                </div>

                <div className="space-y-4 w-full">
                  <div className="inline-flex items-center gap-2 bg-purple-950/30 border border-purple-800/40 text-purple-300 px-4 py-1.5 rounded-full text-xs font-mono font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
                    GPU RENDERING WORKSPACE
                  </div>

                  <h3 className="text-lg font-bold text-white">Rendering Cinematic Frames</h3>
                  
                  {/* Live Progress Logs Panel */}
                  <div className="bg-[#09090C] border border-[#22222A] rounded-xl p-4 font-mono text-[11px] text-gray-400 text-left space-y-1.5 shadow-inner">
                    <div className="flex justify-between border-b border-white/5 pb-1.5 text-gray-500">
                      <span>Status Queue Monitor</span>
                      <span>Job ID: {jobId || 'Allocating...'}</span>
                    </div>
                    <div className="text-purple-400 flex items-center gap-1.5 mt-1.5">
                      <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
                      <span className="truncate">{statusText}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 italic mt-2 text-center">
                      "GPU is rendering frames... Do not close this tab."
                    </p>
                  </div>

                  {/* Polling Statistics Counter */}
                  <div className="flex items-center justify-between text-[11px] text-gray-500 px-1 pt-1 font-mono">
                    <span>Polling status interval: 5s</span>
                    <span>Server requests: {pollCount}</span>
                  </div>
                </div>
              </div>
            )}

            {/* STATE 3: ERROR STATE */}
            {errorMsg && !processing && (
              <div className="my-auto py-10 px-6 text-center flex flex-col items-center max-w-md mx-auto">
                <div className="w-16 h-16 bg-red-950/20 border border-red-900/40 rounded-2xl flex items-center justify-center text-red-400 mb-6">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Generation Failed</h3>
                <p className="text-sm text-gray-400 leading-relaxed mb-6">
                  {errorMsg}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleGenerateAnother}
                    className="px-5 py-2.5 bg-[#1F1F26] border border-[#2F2F3D] hover:bg-[#2A2A35] rounded-xl text-xs text-white transition-all cursor-pointer"
                  >
                    Reset Form
                  </button>
                  <button
                    onClick={handleGenerateVideo}
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-xs font-medium text-white rounded-xl shadow-lg transition-all cursor-pointer hover:opacity-90"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {/* STATE 4: SUCCESS VIDEO PLAYER */}
            {successVideoUrl && !processing && (
              <div className="flex flex-col h-full justify-between gap-6">
                {/* Header info */}
                <div className="flex items-center justify-between border-b border-[#212128] pb-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400 tracking-wider uppercase">
                      COMPLETED SUCCESSFULLY
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 font-mono">
                    Job UUID: {jobId?.substring(0, 12)}...
                  </span>
                </div>

                {/* HTML5 Video Player Container */}
                <div className="relative bg-black rounded-xl overflow-hidden border border-[#2D2D38] shadow-2xl flex-grow aspect-video flex items-center justify-center">
                  <video
                    id="output-video-player"
                    src={successVideoUrl}
                    controls
                    autoPlay
                    loop
                    playsInline
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Video Info and Prompt Review */}
                <div className="bg-[#17171C] border border-[#23232C] rounded-xl p-4 text-xs">
                  <span className="text-gray-400 font-medium block mb-1">PROMPT USED</span>
                  <p className="text-gray-300 italic">"{prompt}"</p>
                </div>

                {/* Action Controls */}
                <div className="flex flex-wrap gap-4 items-center justify-between border-t border-[#212128] pt-4 mt-auto">
                  <a
                    id="download-video-link"
                    href={successVideoUrl}
                    download="generated-video.mp4"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-5 py-3 bg-[#1A1A1E] hover:bg-[#25252B] border border-[#2E2E39] text-xs font-semibold text-white rounded-xl transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-purple-400" />
                    Download Render (.mp4)
                  </a>

                  <button
                    id="generate-another-btn"
                    onClick={handleGenerateAnother}
                    className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-semibold text-white rounded-xl transition-all shadow-md shadow-purple-950/10 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Generate Another
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

      </main>

      {/* Footer system details */}
      <footer className="bg-[#070709] border-t border-[#141418] px-6 py-5 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between text-[11px] text-gray-500 gap-4">
          <div>
            <span>Connected to FastAPI backend with Supabase client routing.</span>
          </div>
          <div className="flex gap-4">
            <span className="hover:text-purple-400 transition-colors">Server Node: GPU-Node-01-A100</span>
            <span>•</span>
            <span className="hover:text-purple-400 transition-colors">Storage: supabase-bucket/renders</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
