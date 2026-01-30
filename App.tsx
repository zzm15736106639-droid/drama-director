
import React, { useState, useRef } from 'react';
import { Clapperboard, Sparkles, Plus, Trash2, Wand2, Upload, Image as ImageIcon, X, LayoutTemplate, Film, ArrowDown, Scissors, CheckCircle2, Palette, Smartphone, Monitor, Brain, ChevronUp, ChevronDown, ListMusic, Users, Spline, Globe2, Clock, History } from 'lucide-react';
import SceneCard from './components/SceneCard';
import { 
  generateScenesFromScript, 
  generateVideoForScene, 
  splitScriptSmartly, 
  generatePromptsForContinuousSegments, 
  analyzeScriptDeeply,
  generateFirstFramePrompt,
  generateImageFromPrompt
} from './services/gemini';
import { Scene, ScriptAnalysis } from './types';

type AppMode = 'storyboard' | 'single';

const STYLES = [
  "电影现实主义 (默认)",
  "动漫 / 漫画",
  "3D 动画 (Pixar 风格)",
  "赛博朋克 / 科幻",
  "复古胶片 (黑色电影)",
  "水彩 / 油画风格",
  "暗黑奇幻"
];

const ERAS = [
  "现代都市 (Modern Day)",
  "古风仙侠 (Ancient/Xianxia)",
  "民国时期 (Republic Era)",
  "赛博未来 (Future/Sci-Fi)",
  "八九十年代 (80s/90s Retro)",
  "中世纪奇幻 (Medieval Fantasy)",
  "二战时期 (WWII Era)"
];

const ETHNICITIES = [
  "不限 (AI 自动决定)",
  "中国人 (Chinese)",
  "欧美 (Western)",
  "日韩 (Japanese/Korean)",
  "东南亚 (Southeast Asian)",
  "南亚 (South Asian)",
  "非洲 (African)",
  "拉美 (Latin American)"
];

const SHOT_DURATIONS = [5, 8, 10];

const App: React.FC = () => {
  // Removed isApiKeyReady state to bypass the checker completely
  const [mode, setMode] = useState<AppMode>('storyboard');
  const [script, setScript] = useState('');
  const [globalReferenceImage, setGlobalReferenceImage] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0]);
  const [selectedEra, setSelectedEra] = useState(ERAS[0]); // New Era State
  const [selectedEthnicity, setSelectedEthnicity] = useState(ETHNICITIES[1]);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [shotDuration, setShotDuration] = useState<number>(8);
  const [showSplitReview, setShowSplitReview] = useState(false);
  const [splitSegments, setSplitSegments] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ScriptAnalysis | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [isProcessingScript, setIsProcessingScript] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleModeChange = (newMode: AppMode) => {
    setMode(newMode);
    setScenes([]); 
    setShowSplitReview(false);
    setAnalysisResult(null);
    setSplitSegments([]);
  };

  const handleAnalyzeScriptDeeply = async () => {
    if (!script.trim()) return;
    setIsAnalyzing(true);
    try {
        const result = await analyzeScriptDeeply(script);
        setAnalysisResult(result);
        setShowAnalysis(true);
    } catch (e) { alert("分析失败"); } finally { setIsAnalyzing(false); }
  };

  const handleAnalyzeScript = async () => {
    if (!script.trim()) return;
    setIsProcessingScript(true);
    try {
      // Pass selectedEra to generation service
      const data = await generateScenesFromScript(script, selectedStyle, selectedEra, selectedEthnicity, globalReferenceImage || undefined, analysisResult);
      setScenes(data.map(item => ({
        id: crypto.randomUUID(), 
        scriptSegment: item.script_segment, 
        visualPrompt: item.visual_prompt,
        imagePrompt: item.image_prompt, // Map image prompt
        styleReferenceImage: globalReferenceImage || undefined, 
        status: 'idle',
        imageStatus: 'idle'
      })));
    } catch (e) { alert("生成分镜失败"); } finally { setIsProcessingScript(false); }
  };

  const handlePrepareSingleShot = async () => {
      if (!script.trim()) return;
      setIsProcessingScript(true);
      try {
          const segments = await splitScriptSmartly(script, shotDuration);
          setSplitSegments(segments);
          setShowSplitReview(true);
      } catch (e) { alert("拆分失败"); } finally { setIsProcessingScript(false); }
  };

  const handleConfirmSplitAndGenerate = async () => {
    if (splitSegments.some(s => !s.trim())) return alert("内容不能为空");
    setIsProcessingScript(true);
    setShowSplitReview(false);
    try {
      // Pass selectedEra to generation service
      const data = await generatePromptsForContinuousSegments(splitSegments, selectedStyle, selectedEra, selectedEthnicity, aspectRatio, shotDuration, globalReferenceImage || undefined, analysisResult);
      setScenes(data.map(item => ({
        id: crypto.randomUUID(), 
        scriptSegment: item.script_segment, 
        visualPrompt: item.visual_prompt, 
        imagePrompt: item.image_prompt, // Map image prompt
        styleReferenceImage: globalReferenceImage || undefined, 
        status: 'idle',
        imageStatus: 'idle'
      })));
    } catch (e) { alert("生成失败"); setShowSplitReview(true); } finally { setIsProcessingScript(false); }
  };

  const handleUpdatePrompt = (id: string, newVideoPrompt: string, newImagePrompt?: string) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, visualPrompt: newVideoPrompt, imagePrompt: newImagePrompt } : s));
  };

  const handleGenerateFirstFrame = async (id: string, promptOverride?: string) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, imageStatus: 'generating', imageErrorMessage: undefined } : s));
    try {
      const scene = scenes.find(s => s.id === id);
      if (!scene) return;
      
      // Use override (edited prompt) or existing property, fallback to generation if completely missing
      let promptToUse = promptOverride || scene.imagePrompt;
      if (!promptToUse) {
         // Pass selectedEra and aspectRatio to generation service
         promptToUse = await generateFirstFramePrompt(
             scene.scriptSegment, 
             selectedStyle, 
             selectedEra, 
             selectedEthnicity, 
             aspectRatio, // Pass current aspectRatio
             scene.styleReferenceImage || globalReferenceImage || undefined
         );
         // Update the prompt in state if we had to generate it on the fly
         handleUpdatePrompt(id, scene.visualPrompt, promptToUse);
      }

      const imageUrl = await generateImageFromPrompt(promptToUse, aspectRatio === '16:9' ? '16:9' : '9:16');
      
      setScenes(prev => prev.map(s => s.id === id ? { ...s, generatedImage: imageUrl, imageStatus: 'completed' } : s));
    } catch (e: any) {
      setScenes(prev => prev.map(s => s.id === id ? { ...s, imageStatus: 'error', imageErrorMessage: e.message } : s));
    }
  };

  const extractLastFrameFromVideo = async (videoUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.crossOrigin = "anonymous"; video.src = videoUrl; video.muted = true; video.playsInline = true; video.preload = 'auto'; 
        const timeout = setTimeout(() => reject(new Error("提取超时")), 10000);
        const capture = () => {
             clearTimeout(timeout);
             try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth; canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.9));
                } else reject(new Error("Context error"));
             } catch (e) { reject(e); } finally { video.removeAttribute('src'); video.load(); }
        };
        video.onloadedmetadata = () => video.currentTime = Math.max(0, video.duration - 0.1);
        video.onseeked = () => video.readyState >= 2 ? capture() : video.oncanplay = capture;
        video.onerror = () => { clearTimeout(timeout); reject(new Error("Video error")); };
    });
  };

  const handleGenerateVideo = async (id: string, promptOverride?: string) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, status: 'generating_video', errorMessage: undefined, visualPrompt: promptOverride || s.visualPrompt } : s));
    try {
        const scene = scenes.find(s => s.id === id);
        if (!scene) return;
        const videoUrl = await generateVideoForScene(
            promptOverride || scene.visualPrompt, 
            scene.generatedImage, 
            aspectRatio,
            { style: selectedStyle, era: selectedEra } // Pass global context to enforce era/style
        );
        setScenes(prev => prev.map(s => s.id === id ? { ...s, status: 'completed', videoUrl, aspectRatio } : s));
        const sceneIndex = scenes.findIndex(s => s.id === id);
        
        // Continuity Logic: Only propagate if next scene exists
        if (mode === 'single' && sceneIndex !== -1 && sceneIndex < scenes.length - 1) {
            try {
                // Only wait and extract if next scene doesn't have an image yet
                // If user generated one manually, we respect that (parallel workflow)
                const nextScene = scenes[sceneIndex + 1];
                if (!nextScene.generatedImage) {
                    await new Promise(r => setTimeout(r, 500));
                    const lastFrame = await extractLastFrameFromVideo(videoUrl);
                    setScenes(prev => {
                       const idx = prev.findIndex(s => s.id === id);
                       if (idx === -1 || idx === prev.length - 1) return prev;
                       const updated = [...prev];
                       // Double check inside state update to be safe
                       if (!updated[idx+1].generatedImage) {
                          updated[idx + 1] = { ...updated[idx + 1], generatedImage: lastFrame, imageStatus: 'completed' }; // Ensure imageStatus is updated too
                       }
                       return updated;
                    });
                }
            } catch (e) { console.warn(e); }
        }
    } catch (e: any) {
        setScenes(prev => prev.map(s => s.id === id ? { ...s, status: 'error', errorMessage: e.message || "未知错误" } : s));
    }
  };

  // Direct render without any KeyChecker condition
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-purple-500/30">
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-blue-600 to-purple-600 p-2 rounded-lg"><Clapperboard className="w-5 h-5 text-white" /></div>
            <h1 className="text-xl font-bold tracking-tight">AI 短剧导演 <span className="text-purple-400 font-light text-sm ml-1">DramaScripter AI</span></h1>
          </div>
          <div className="text-xs text-slate-500">由 Gemini & Veo 驱动</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-center mb-10">
          <div className="bg-slate-900 p-1 rounded-xl flex gap-1 border border-slate-800">
            <button onClick={() => handleModeChange('storyboard')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'storyboard' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}><LayoutTemplate className="w-4 h-4" /> 分镜脚本模式</button>
            <button onClick={() => handleModeChange('single')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'single' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}><Film className="w-4 h-4" /> 连贯镜头模式</button>
          </div>
        </div>

        <section className={`mb-12 transition-all duration-500 ${showSplitReview ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
               <div className="flex items-center gap-2">
                  <Sparkles className={`w-5 h-5 ${mode === 'single' ? 'text-purple-400' : 'text-blue-400'}`} />
                  <h2 className="text-lg font-semibold text-white">{mode === 'single' ? '连贯生成设置' : '剧本输入 & 参考图'}</h2>
               </div>
               <div className="flex flex-wrap items-center gap-4">
                   <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-700">
                      <button onClick={() => setAspectRatio('16:9')} className={`p-2 rounded-md transition-all flex items-center gap-2 text-xs font-medium ${aspectRatio === '16:9' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}><Monitor className="w-4 h-4" /> 16:9</button>
                      <button onClick={() => setAspectRatio('9:16')} className={`p-2 rounded-md transition-all flex items-center gap-2 text-xs font-medium ${aspectRatio === '9:16' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}><Smartphone className="w-4 h-4" /> 9:16</button>
                   </div>
                   {mode === 'single' && (
                       <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700 group relative">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <select value={shotDuration} onChange={(e) => setShotDuration(Number(e.target.value))} className="bg-transparent text-slate-300 text-sm outline-none cursor-pointer">
                            {SHOT_DURATIONS.map(d => <option key={d} value={d} className="bg-slate-900">{d}秒 / 镜</option>)}
                          </select>
                       </div>
                   )}
                   {/* Era Selector */}
                   <div className="flex items-center gap-2">
                     <History className="w-4 h-4 text-slate-400" />
                     <select value={selectedEra} onChange={(e) => setSelectedEra(e.target.value)} className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg block p-2 outline-none max-w-[140px]">
                       {ERAS.map(era => <option key={era} value={era}>{era}</option>)}
                     </select>
                   </div>
                   <div className="flex items-center gap-2">
                     <Palette className="w-4 h-4 text-slate-400" />
                     <select value={selectedStyle} onChange={(e) => setSelectedStyle(e.target.value)} className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg block p-2 outline-none max-w-[140px]">
                       {STYLES.map(style => <option key={style} value={style}>{style}</option>)}
                     </select>
                   </div>
                   <div className="flex items-center gap-2">
                     <Globe2 className="w-4 h-4 text-slate-400" />
                     <select value={selectedEthnicity} onChange={(e) => setSelectedEthnicity(e.target.value)} className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg block p-2 outline-none max-w-[140px]">
                       {ETHNICITIES.map(eth => <option key={eth} value={eth}>{eth}</option>)}
                     </select>
                   </div>
               </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 relative">
                    <textarea value={script} onChange={(e) => setScript(e.target.value)} placeholder={mode === 'single' ? `输入剧本，AI 将按 ${shotDuration}秒/镜 节奏拆分...` : "在此粘贴剧本或解说词..."} className="w-full h-52 bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-300 focus:ring-2 focus:ring-purple-500 outline-none resize-none shadow-inner" />
                </div>
                <div className="md:col-span-1 h-52">
                    <div onClick={() => !globalReferenceImage && fileInputRef.current?.click()} className={`w-full h-full rounded-xl border-2 border-dashed transition-all relative overflow-hidden flex flex-col items-center justify-center cursor-pointer ${globalReferenceImage ? 'border-purple-500/50 bg-slate-900' : 'border-slate-800 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900'}`}>
                        <input type="file" ref={fileInputRef} onChange={(e) => {
                             if (e.target.files?.[0]) {
                                 const r = new FileReader(); r.onloadend = () => setGlobalReferenceImage(r.result as string); r.readAsDataURL(e.target.files[0]);
                             }
                        }} className="hidden" accept="image/*" />
                        {globalReferenceImage ? <img src={globalReferenceImage} alt="Reference" className="w-full h-full object-cover opacity-80" /> : <div className="text-center p-4"><ImageIcon className="w-6 h-6 text-slate-500 mx-auto mb-3" /><p className="text-sm font-medium text-slate-300">上传风格图</p></div>}
                    </div>
                </div>
            </div>
            <div className="mt-4 flex justify-end gap-3">
                <button onClick={handleAnalyzeScriptDeeply} disabled={isProcessingScript || isAnalyzing || !script.trim()} className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all shadow-lg border border-slate-700 ${isAnalyzing || !script.trim() ? 'bg-slate-900 text-slate-500' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
                    {isAnalyzing ? <><Brain className="w-4 h-4 animate-pulse" /> 分析中...</> : <><Brain className="w-4 h-4" /> AI 深度分析</>}
                </button>
                <button onClick={mode === 'single' ? handlePrepareSingleShot : handleAnalyzeScript} disabled={isProcessingScript || isAnalyzing || !script.trim()} className={`flex items-center gap-2 px-8 py-3 rounded-full font-medium transition-all shadow-lg ${isProcessingScript || isAnalyzing || !script.trim() ? 'bg-slate-800 text-slate-500' : mode === 'single' ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'}`}>
                    {isProcessingScript ? <><Wand2 className="w-4 h-4 animate-spin" /> 处理中...</> : mode === 'single' ? <><Scissors className="w-4 h-4" /> 智能拆分镜头</> : <><Wand2 className="w-4 h-4" /> 生成分镜</>}
                </button>
            </div>
        </section>

        {scenes.length > 0 && !showSplitReview && (
            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">{mode === 'single' ? '连贯序列生成' : '分镜列表'}</h2>
                    <button onClick={() => setScenes(prev => [...prev, { id: crypto.randomUUID(), scriptSegment: "新场景", visualPrompt: "新画面描述", status: 'idle', imageStatus: 'idle' }])} className="text-sm text-slate-400 hover:text-white flex items-center gap-1"><Plus className="w-4 h-4" /> 添加</button>
                </div>
                <div className="grid grid-cols-1 gap-6">
                    {scenes.map((scene, index) => (
                        <div key={scene.id} className="relative">
                            {mode === 'single' && index < scenes.length - 1 && <div className="absolute left-1/2 -bottom-8 -translate-x-1/2 text-purple-500/30 flex flex-col items-center"><ArrowDown className="w-4 h-4" /></div>}
                            
                            {/* Updated Label Logic */}
                            {mode === 'single' && (
                                <div className="mb-2 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                            index === 0 ? 'bg-blue-900/50 text-blue-300' : 
                                            index === scenes.length - 1 ? 'bg-emerald-900/50 text-emerald-300' :
                                            'bg-purple-900/50 text-purple-300'
                                        }`}>
                                            {index === 0 ? '第一部分：起始' : 
                                             index === scenes.length - 1 ? '最终部分：高潮/收尾' : '承接部分：发展'}
                                        </span>
                                        {index > 0 && !scene.generatedImage && (
                                            <span className="text-xs text-slate-500 flex items-center gap-1">
                                                * 建议生成首帧或等待上一镜头
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Removed the opacity/pointer-events restriction to allow parallel generation */}
                            <div>
                                <SceneCard 
                                    scene={scene} 
                                    onUpdatePrompt={handleUpdatePrompt} 
                                    onUploadReference={() => {}} 
                                    onGenerateVideo={handleGenerateVideo}
                                    onGenerateFirstFrame={mode === 'single' ? handleGenerateFirstFrame : undefined}
                                    selectedStyle={selectedStyle}
                                    selectedEra={selectedEra} // Pass new prop
                                    selectedEthnicity={selectedEthnicity}
                                    aspectRatio={aspectRatio}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        )}

        {showSplitReview && (
            <section className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-slate-900/50 border border-slate-700/50 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-6"><Scissors className="w-5 h-5 text-purple-400" /><h2 className="text-lg font-semibold text-white">确认镜头切分 ({shotDuration}秒/镜)</h2></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {splitSegments.map((seg, index) => (
                        <div key={index} className="flex flex-col gap-2 relative">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">镜头 {index + 1}</label>
                            <textarea value={seg} onChange={(e) => { const n = [...splitSegments]; n[index] = e.target.value; setSplitSegments(n); }} className="w-full h-32 bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:border-purple-500 outline-none resize-none" />
                        </div>
                    ))}
                </div>
                <div className="mt-6 flex justify-end gap-3">
                     <button onClick={() => setShowSplitReview(false)} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>
                     <button onClick={handleConfirmSplitAndGenerate} className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> 开始生成</button>
                </div>
            </section>
        )}
      </main>
    </div>
  );
};

export default App;
