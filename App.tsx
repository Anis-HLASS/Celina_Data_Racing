
import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause,
  Settings, 
  Database, 
  Download, 
  ArrowRight, 
  RefreshCw,
  Clock,
  Type as TypeIcon,
  Sparkles,
  RotateCcw,
  Music as MusicIcon,
  Volume2,
  VolumeX,
  CheckCircle,
  Activity,
  Loader2,
  Image as ImageIcon,
  Upload,
  Video,
  ListFilter,
  BarChart3,
  CircleDot,
  TrendingUp
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  RawDataRow, 
  ProcessedDataPoint, 
  ColumnMapping, 
  AnimationConfig, 
  AppState 
} from './types';
import { processData } from './utils/dataProcessor';
import RacingChart from './components/RacingChart';
import BubbleChart from './components/BubbleChart';
import LineChart from './components/LineChart';

// Logo CÉLINA Data Racing par défaut (Cerveau Néon)
const DEFAULT_LOGO_URL = "https://i.ibb.co/vzY3Z1P/celina-logo.png";

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [rawData, setRawData] = useState<RawDataRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    dateCol: '',
    entityCol: '',
    valueCol: ''
  });
  const [config, setConfig] = useState<AnimationConfig>({
    duration: 30,
    title: 'ANALYSE CÉLINA DATA',
    entitiesToShow: 12,
    chartType: 'bar_race'
  });
  const [processedData, setProcessedData] = useState<ProcessedDataPoint[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState(RACING_TRACKS[0]);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  
  const [logoUrl, setLogoUrl] = useState<string>(DEFAULT_LOGO_URL);

  const [isAutoRecordEnabled, setIsAutoRecordEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [replayTrigger, setReplayTrigger] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const logoImageRef = useRef<HTMLImageElement | null>(null);

  const isIntroActiveRef = useRef(false);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = "anonymous";
      audioRef.current.loop = true;
    }
    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio();
      previewAudioRef.current.crossOrigin = "anonymous";
      previewAudioRef.current.onended = () => setPreviewTrackId(null);
      previewAudioRef.current.onpause = () => setPreviewTrackId(null);
    }
    return () => {
      audioRef.current?.pause();
      previewAudioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = logoUrl;
    img.onload = () => {
      logoImageRef.current = img;
    };
  }, [logoUrl]);

  const getSupportedMimeType = () => {
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return undefined;
  };

  const validateAndSetAudioSource = (url: string, audioElem: HTMLAudioElement | null) => {
    if (!audioElem) return false;
    if (!url || url.trim() === "" || url.includes('youtube.com') || url.includes('youtu.be')) return false;
    audioElem.src = url;
    return true;
  };

  const safePlay = async (audioElem: HTMLAudioElement | null) => {
    if (!audioElem || !audioElem.src || audioElem.src === window.location.href) return;
    try {
      const playPromise = audioElem.play();
      if (playPromise !== undefined) await playPromise;
    } catch (error) {}
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (logoUrl !== DEFAULT_LOGO_URL && logoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(logoUrl);
      }
      setLogoUrl(URL.createObjectURL(file));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws) as RawDataRow[];
      if (data.length > 0) {
        setRawData(data);
        setColumns(Object.keys(data[0]));
        setState(AppState.MAPPING);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleStartProcessing = () => {
    if (!mapping.dateCol || !mapping.entityCol || !mapping.valueCol) return;
    setState(AppState.PROCESSING);
    setTimeout(() => {
      setProcessedData(processData(rawData, mapping));
      setState(AppState.PREVIEW);
    }, 800);
  };

  const handleReplay = () => {
    if (isAutoRecordEnabled) {
      startRecordingAndReplay();
    } else {
      triggerAnimationOnly();
    }
  };

  const triggerAnimationOnly = () => {
    setReplayTrigger(prev => prev + 1);
    setIsPaused(false);
    setRecordedVideoUrl(null);
    if (audioRef.current && validateAndSetAudioSource(selectedMusic.url, audioRef.current)) {
      audioRef.current.currentTime = 0;
      safePlay(audioRef.current);
    }
  };

  const startRecordingAndReplay = async () => {
    setRecordedVideoUrl(null);
    setIsRecording(true);
    setIsProcessing(false);
    isIntroActiveRef.current = true;
    
    setReplayTrigger(prev => prev + 1);
    setIsPaused(true);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    const width = 1000; 
    const height = 650;
    canvas.width = width;
    canvas.height = height;

    const videoStream = canvas.captureStream(30); 
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const dest = audioCtx.createMediaStreamDestination();
    
    if (audioRef.current) {
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      try {
        const source = audioCtx.createMediaElementSource(audioRef.current);
        source.connect(dest);
        source.connect(audioCtx.destination);
      } catch (e) {}
    }
    
    const combinedStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ]);

    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 5000000 });
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      setIsProcessing(true);
      setTimeout(() => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
        setRecordedVideoUrl(URL.createObjectURL(blob));
        setIsProcessing(false);
      }, 1000);
    };

    recorder.start();

    const drawFrame = () => {
      if (recorderRef.current?.state === 'recording') {
        if (ctx) {
          if (isIntroActiveRef.current) {
            ctx.fillStyle = '#0f1423'; 
            ctx.fillRect(0, 0, width, height);
            if (logoImageRef.current) {
              const img = logoImageRef.current;
              const scale = Math.min(width * 0.6 / img.width, height * 0.6 / img.height);
              const drawW = img.width * scale;
              const drawH = img.height * scale;
              ctx.drawImage(img, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
            }
          } else {
            const currentSvg = document.getElementById('racing-chart-svg');
            if (currentSvg) {
              const svgString = new XMLSerializer().serializeToString(currentSvg);
              const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
              const url = URL.createObjectURL(svgBlob);
              const img = new Image();
              img.onload = () => {
                ctx.fillStyle = '#0f1423'; 
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                URL.revokeObjectURL(url);
              };
              img.src = url;
            }
          }
        }
        requestAnimationFrame(drawFrame);
      }
    };
    drawFrame();

    setTimeout(() => {
      isIntroActiveRef.current = false;
      setIsPaused(false);
      if (audioRef.current && validateAndSetAudioSource(selectedMusic.url, audioRef.current)) {
        audioRef.current.currentTime = 0;
        safePlay(audioRef.current);
      }
    }, 1000);
  };

  const onAnimationFinished = () => {
    setIsPaused(true);
    if (audioRef.current) audioRef.current.pause();
    if (isRecording && recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTogglePause = () => {
    if (!isPaused && isRecording) {
      onAnimationFinished();
    } else {
      setIsPaused(!isPaused);
    }
  };

  const handlePreviewMusic = async (track: typeof RACING_TRACKS[0]) => {
    if (previewTrackId === track.id) {
      previewAudioRef.current?.pause();
      setPreviewTrackId(null);
      return;
    }
    if (previewAudioRef.current && validateAndSetAudioSource(track.url, previewAudioRef.current)) {
      setPreviewTrackId(track.id);
      safePlay(previewAudioRef.current);
    }
  };

  const downloadVideo = () => {
    if (recordedVideoUrl) {
      const a = document.createElement('a');
      a.href = recordedVideoUrl;
      const extension = recordedVideoUrl.includes('mp4') ? 'mp4' : 'webm';
      a.download = `CELINA-DATA-RACING-${new Date().getTime()}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const reset = () => {
    setState(AppState.IDLE);
    setRawData([]);
    setProcessedData([]);
    setRecordedVideoUrl(null);
    setIsRecording(false);
    setIsProcessing(false);
    isIntroActiveRef.current = false;
    audioRef.current?.pause();
    previewAudioRef.current?.pause();
  };

  const HlesLogo = () => (
    <div className="relative flex items-center justify-center overflow-hidden rounded-lg w-12 h-12 border border-indigo-500/30 bg-slate-900">
      <img src={logoUrl} alt="CÉLINA" className="w-full h-full object-contain" />
    </div>
  );

  const renderActiveChart = () => {
    const chartProps = {
      data: processedData,
      config: config,
      isPaused: isPaused,
      onFinished: onAnimationFinished
    };
    
    switch (config.chartType) {
      case 'bar_race': return <RacingChart key={replayTrigger} {...chartProps} />;
      case 'bubble_3d': return <BubbleChart key={replayTrigger} {...chartProps} />;
      case 'global_line': return <LineChart key={replayTrigger} {...chartProps} />;
      default: return <RacingChart key={replayTrigger} {...chartProps} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#020617] text-slate-100 selection:bg-indigo-500/30 font-sans">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <HlesLogo />
            <div className="h-10 w-px bg-slate-800 mx-2" />
            <div>
              <h1 className="text-2xl font-black tracking-tighter bg-gradient-to-r from-white via-indigo-200 to-indigo-500 bg-clip-text text-transparent uppercase italic">
                CÉLINA DATA <span className="text-indigo-400">RACING</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-bold tracking-[0.2em] uppercase">Intelligence Visuelle CÉLINA</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {state !== AppState.IDLE && (
              <button onClick={reset} className="text-xs font-bold text-slate-400 hover:text-white transition-all flex items-center gap-2 group uppercase tracking-widest">
                <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" /> NOUVELLE SESSION
              </button>
            )}
            <div className="h-6 w-px bg-slate-800" />
            <span className="text-[10px] px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/30 font-black">
              ENGINE v6.0 (MULTI-MODE)
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12">
        {state === AppState.IDLE && (
          <div className="max-w-3xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="text-center space-y-8">
              <div className="flex justify-center">
                <div className="relative p-1 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl shadow-2xl shadow-indigo-500/20">
                  <img src={logoUrl} alt="Logo" className="w-48 h-48 rounded-[1.4rem] object-contain bg-[#0f1423]" />
                </div>
              </div>
              <h2 className="text-6xl font-black tracking-tight leading-tight uppercase italic text-white">
                Data Studio <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">by CÉLINA</span>
              </h2>
              <p className="text-slate-400 text-xl font-medium max-w-xl mx-auto italic">
                Transformez vos chiffres en récits visuels. 3 modes haute performance pour vos rapports.
              </p>
            </div>
            <div className="relative group">
              <div className="absolute -inset-2 bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 rounded-[2rem] blur-2xl opacity-20 group-hover:opacity-40 transition duration-1000"></div>
              <label className="relative flex flex-col items-center justify-center w-full h-80 border-2 border-dashed border-slate-800 rounded-[2rem] bg-slate-900/50 hover:bg-slate-800/40 transition-all cursor-pointer">
                <div className="flex flex-col items-center justify-center p-10">
                  <div className="p-6 bg-indigo-500/10 rounded-full mb-6"><Database className="w-12 h-12 text-indigo-400" /></div>
                  <p className="text-xl font-bold text-slate-200 uppercase tracking-widest">Importer Dataset (XLSX/CSV)</p>
                </div>
                <input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx,.xls,.csv" />
              </label>
            </div>
          </div>
        )}

        {state === AppState.MAPPING && (
          <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in zoom-in-95 duration-500">
             <div className="flex items-end justify-between border-b border-slate-800 pb-6">
              <h2 className="text-3xl font-black italic uppercase tracking-tighter">CONFIGURATEUR CÉLINA</h2>
              <span className="text-2xl font-mono font-bold text-indigo-400">{rawData.length} POINTS ANALYSÉS</span>
            </div>

            {/* CHOIX DU TYPE DE GRAPHIQUE - 3 OPTIONS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <button 
                  onClick={() => setConfig(p => ({ ...p, chartType: 'bar_race' }))}
                  className={`p-6 rounded-[1.5rem] border-2 transition-all flex flex-col items-center text-center gap-4 ${config.chartType === 'bar_race' ? 'bg-indigo-500/10 border-indigo-500 shadow-xl' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}
               >
                 <div className={`p-3 rounded-xl ${config.chartType === 'bar_race' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500'}`}><BarChart3 className="w-8 h-8" /></div>
                 <div>
                   <p className="font-black uppercase tracking-tight text-lg italic">Bar Chart Race</p>
                   <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Course cumulative horizontale</p>
                 </div>
               </button>
               
               <button 
                  onClick={() => setConfig(p => ({ ...p, chartType: 'global_line' }))}
                  className={`p-6 rounded-[1.5rem] border-2 transition-all flex flex-col items-center text-center gap-4 ${config.chartType === 'global_line' ? 'bg-yellow-500/10 border-yellow-500 shadow-xl' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}
               >
                 <div className={`p-3 rounded-xl ${config.chartType === 'global_line' ? 'bg-yellow-500 text-white' : 'bg-slate-800 text-slate-500'}`}><TrendingUp className="w-8 h-8" /></div>
                 <div>
                   <p className="font-black uppercase tracking-tight text-lg italic">Évolution Globale</p>
                   <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Courbe journalière non-cumulative</p>
                 </div>
               </button>

               <button 
                  onClick={() => setConfig(p => ({ ...p, chartType: 'bubble_3d' }))}
                  className={`p-6 rounded-[1.5rem] border-2 transition-all flex flex-col items-center text-center gap-4 ${config.chartType === 'bubble_3d' ? 'bg-orange-500/10 border-orange-500 shadow-xl' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}
               >
                 <div className={`p-3 rounded-xl ${config.chartType === 'bubble_3d' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-500'}`}><CircleDot className="w-8 h-8" /></div>
                 <div>
                   <p className="font-black uppercase tracking-tight text-lg italic">Bubble 3D Inflation</p>
                   <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Gonflement sphérique cumulatif</p>
                 </div>
               </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { icon: Clock, label: 'Axe Temps', col: 'dateCol', color: 'blue' },
                { icon: TypeIcon, label: 'Labels Entités', col: 'entityCol', color: 'purple' },
                { icon: Database, label: 'Valeurs', col: 'valueCol', color: 'green' }
              ].map((item, idx) => (
                <div key={idx} className="p-8 bg-slate-900/50 rounded-3xl border border-slate-800 space-y-6">
                  <div className={`p-4 bg-${item.color}-500/10 rounded-2xl w-fit`}><item.icon className={`w-8 h-8 text-${item.color}-400`} /></div>
                  <h3 className="text-lg font-bold uppercase tracking-tight">{item.label}</h3>
                  <select className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-1 focus:ring-indigo-500" value={(mapping as any)[item.col]} onChange={(e) => setMapping(p => ({ ...p, [item.col]: e.target.value }))}>
                    <option value="">Choisir colonne...</option>
                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex justify-center pt-8">
              <button onClick={handleStartProcessing} disabled={!mapping.dateCol || !mapping.entityCol || !mapping.valueCol} className="px-12 py-5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white font-black rounded-2xl transition-all shadow-2xl uppercase tracking-tighter flex items-center gap-3 active:scale-95">
                Générer Preview Studio <ArrowRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}

        {state === AppState.PREVIEW && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 relative">
            {isProcessing && (
              <div className="absolute inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center rounded-3xl">
                <div className="bg-slate-900 p-10 rounded-[2rem] border border-indigo-500/30 flex items-center gap-6 shadow-2xl animate-pulse">
                  <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                  <div>
                    <p className="font-black uppercase italic text-indigo-400 text-xl">Rendu CÉLINA High-Fidelity...</p>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Encodage des textures et lumières</p>
                  </div>
                </div>
              </div>
            )}

            <div className="lg:col-span-8 space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)] ${isPaused ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                  <h2 className="text-2xl font-black tracking-tight uppercase italic">{isRecording ? 'Capturing Session' : 'Direct Studio Preview'}</h2>
                </div>
                <div className="flex gap-3">
                   <button onClick={handleReplay} disabled={isRecording || isProcessing} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all border flex items-center gap-2 uppercase tracking-widest active:scale-95 ${isRecording ? 'bg-indigo-500 text-white border-indigo-400' : 'bg-slate-800 hover:bg-slate-700 border-slate-700'}`}>
                     <RotateCcw className={`w-4 h-4 ${isRecording ? 'animate-spin' : ''}`} /> {isRecording ? 'Capturing...' : 'Reset & Replay'}
                   </button>
                   <button onClick={handleTogglePause} disabled={isRecording} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-black transition-all border border-slate-700 flex items-center gap-2 uppercase tracking-widest active:scale-95">
                     {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />} {isPaused ? 'Lecture' : 'Pause'}
                   </button>
                </div>
              </div>

              {renderActiveChart()}

              {(recordedVideoUrl && !isProcessing) && (
                <div className="p-8 bg-green-500/10 border border-green-500/30 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in slide-in-from-bottom-4 shadow-2xl">
                  <div className="flex items-center gap-5">
                    <div className="p-3 bg-green-500/20 rounded-full"><CheckCircle className="w-8 h-8 text-green-400" /></div>
                    <div>
                      <p className="font-black uppercase italic text-green-400 text-lg">Export Vidéo Masterisé</p>
                      <p className="text-sm text-slate-400 font-medium italic">Séquence introductive (1s) et animation finalisée.</p>
                    </div>
                  </div>
                  <button onClick={downloadVideo} className="px-8 py-4 bg-green-500 text-white font-black rounded-xl hover:bg-green-600 transition-all flex items-center gap-3 uppercase tracking-widest shadow-lg">
                    <Download className="w-5 h-5" /> Télécharger Master MP4
                  </button>
                </div>
              )}
            </div>

            <div className="lg:col-span-4 space-y-8">
              <div className="p-8 bg-slate-900/40 backdrop-blur-md rounded-[2rem] border border-slate-800 space-y-8 sticky top-28 shadow-2xl">
                <div className="flex items-center gap-3 pb-6 border-b border-slate-800">
                  <Settings className="w-6 h-6 text-indigo-400" />
                  <h3 className="font-black uppercase tracking-tight">POST-PRODUCTION</h3>
                </div>
                <div className="space-y-6">
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isAutoRecordEnabled ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'}`}>
                          <Video className="w-4 h-4" />
                        </div>
                        <label className="text-xs font-black uppercase tracking-widest cursor-pointer select-none" htmlFor="exportCheckbox">Capture au Start</label>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input id="exportCheckbox" type="checkbox" className="sr-only peer" checked={isAutoRecordEnabled} onChange={(e) => setIsAutoRecordEnabled(e.target.checked)} />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                    <p className="text-[9px] text-slate-500 font-bold uppercase leading-tight italic">Inclut l'intro Logo CÉLINA (1s) dans le fichier final.</p>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <ImageIcon className="w-3 h-3" /> Logo Introductif
                    </label>
                    <label className="flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl cursor-pointer hover:bg-slate-700 transition-all">
                      <Upload className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold text-slate-300 truncate">
                        {logoUrl === DEFAULT_LOGO_URL ? "Logo par Défaut" : "Custom Logo"}
                      </span>
                      <input type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleLogoUpload} />
                    </label>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Titre du Graphique</label>
                    <input type="text" className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3.5 text-sm font-bold outline-none focus:ring-1 focus:ring-indigo-500 uppercase" value={config.title} onChange={(e) => setConfig(p => ({ ...p, title: e.target.value }))} />
                  </div>

                  <div className="space-y-4">
                      <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                         <label className="flex items-center gap-2"><ListFilter className="w-3 h-3" /> Top Éléments</label>
                         <span className="text-indigo-400 font-mono font-bold">{config.entitiesToShow}</span>
                      </div>
                      <input type="range" min="4" max="40" step="1" className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500" value={config.entitiesToShow} onChange={(e) => setConfig(p => ({ ...p, entitiesToShow: parseInt(e.target.value) }))} />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><MusicIcon className="w-3 h-3" /> Audio Master</label>
                    <div className="grid grid-cols-1 gap-2">
                      {RACING_TRACKS.map(track => (
                        <div key={track.id} className="flex gap-2">
                          <button onClick={() => setSelectedMusic(track)} className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-between ${selectedMusic.id === track.id ? 'bg-indigo-600 border-indigo-400 shadow-lg' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}>
                            {track.name}
                            {selectedMusic.id === track.id && <Sparkles className="w-3 h-3" />}
                          </button>
                          <button onClick={() => handlePreviewMusic(track)} className={`p-2.5 rounded-xl border transition-all active:scale-90 ${previewTrackId === track.id ? 'bg-pink-500 text-white' : 'bg-slate-800 border-slate-700'}`}>
                            {previewTrackId === track.id ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                       <label className="flex items-center gap-2"><Clock className="w-3 h-3" /> Durée de l'animation</label>
                       <span className="text-indigo-400 font-mono font-bold">{config.duration}s</span>
                    </div>
                    <input type="range" min="10" max="180" step="5" className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500" value={config.duration} onChange={(e) => setConfig(p => ({ ...p, duration: parseInt(e.target.value) }))} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const RACING_TRACKS = [
  { id: 'track1', name: 'Cyberdrive Energy', url: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a7315b.mp3' },
  { id: 'track2', name: 'Synthwave Velocity', url: 'https://cdn.pixabay.com/audio/2022/10/24/audio_3497d3e691.mp3' },
  { id: 'track3', name: 'Data Peak', url: 'https://cdn.pixabay.com/audio/2021/11/23/audio_02ad29486c.mp3' }
];

export default App;
