
import React, { useState, useRef } from 'react';
import { Scene } from '../types';
import { Play, Download, AlertCircle, Loader2, Video, Film, Edit2, Check, Image as ImageIcon, Upload, Sparkles, Wand, Camera, RefreshCw } from 'lucide-react';
import { refinePromptWithAI } from '../services/gemini';

interface SceneCardProps {
  scene: Scene;
  onUpdatePrompt: (id: string, newVideoPrompt: string, newImagePrompt?: string) => void;
  onUploadReference: (id: string, file: File) => void;
  onGenerateVideo: (id: string, promptOverride?: string) => void;
  onGenerateFirstFrame?: (id: string, promptOverride?: string) => void;
  // Context props for AI refinement
  selectedStyle?: string;
  selectedEra?: string; // New Era Prop
  selectedEthnicity?: string;
  aspectRatio?: string;
}

const SceneCard: React.FC<SceneCardProps> = ({ 
  scene, 
  onUpdatePrompt, 
  onUploadReference, 
  onGenerateVideo,
  onGenerateFirstFrame,
  selectedStyle = "默认",
  selectedEra = "默认", // Default era
  selectedEthnicity = "默认",
  aspectRatio = "16:9"
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localVideoPrompt, setLocalVideoPrompt] = useState(scene.visualPrompt);
  const [localImagePrompt, setLocalImagePrompt] = useState(scene.imagePrompt || "");
  
  // AI Refinement State
  const [videoAiInstruction, setVideoAiInstruction] = useState('');
  const [imageAiInstruction, setImageAiInstruction] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSavePrompt = () => {
    onUpdatePrompt(scene.id, localVideoPrompt, localImagePrompt);
    setIsEditing(false);
  };

  const handleVideoGenerateClick = () => {
    if (isEditing) handleSavePrompt();
    else if (localVideoPrompt !== scene.visualPrompt) onUpdatePrompt(scene.id, localVideoPrompt, localImagePrompt);
    onGenerateVideo(scene.id, localVideoPrompt);
  };

  const handleImageGenerateClick = () => {
      if (!onGenerateFirstFrame) return;
      if (isEditing) handleSavePrompt();
      const promptToUse = isEditing ? localImagePrompt : (scene.imagePrompt || scene.scriptSegment);
      onGenerateFirstFrame(scene.id, promptToUse);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadReference(scene.id, e.target.files[0]);
    }
  };

  const handleVideoAiRefine = async () => {
    if (!videoAiInstruction.trim()) return;
    setIsRefining(true);
    try {
        const refined = await refinePromptWithAI(localVideoPrompt, videoAiInstruction, 'video', {
            style: selectedStyle,
            era: selectedEra,
            ethnicity: selectedEthnicity,
            aspectRatio: aspectRatio
        });
        setLocalVideoPrompt(refined);
        setVideoAiInstruction('');
    } catch (e) {
        console.error("Failed to refine video prompt", e);
    } finally {
        setIsRefining(false);
    }
  };

  const handleImageAiRefine = async () => {
    if (!imageAiInstruction.trim()) return;
    setIsRefining(true);
    try {
        const refined = await refinePromptWithAI(
            localImagePrompt || scene.scriptSegment, 
            imageAiInstruction, 
            'image', 
            {
                style: selectedStyle,
                era: selectedEra,
                ethnicity: selectedEthnicity,
                aspectRatio: aspectRatio
            }
        );
        setLocalImagePrompt(refined);
        setImageAiInstruction('');
    } catch (e) {
        console.error("Failed to refine image prompt", e);
    } finally {
        setIsRefining(false);
    }
  };

  const isPortrait = scene.aspectRatio === '9:16';

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden hover:border-slate-600 transition-all duration-300 shadow-sm">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
        
        {/* Left Column: Script, Prompt & Assets */}
        <div className="p-6 col-span-1 lg:col-span-7 flex flex-col gap-6 border-b lg:border-b-0 lg:border-r border-slate-700">
          
          {/* Header Controls */}
           <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                    <Film className="w-3 h-3" />
                    <span>剧本片段</span>
                 </div>
                {!isEditing ? (
                     <button onClick={() => setIsEditing(true)} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
                        <Edit2 className="w-3 h-3" /> 编辑描述
                     </button>
                ) : (
                    <button onClick={handleSavePrompt} className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1 transition-colors">
                        <Check className="w-3 h-3" /> 保存修改
                     </button>
                )}
           </div>

          {/* Script Segment */}
          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
             <p className="text-slate-300 text-sm leading-relaxed italic">
                "{scene.scriptSegment}"
             </p>
          </div>

          {/* Prompt Section Container */}
          <div className="flex flex-col gap-4">
              
              {/* Video Prompt */}
              <div className="flex flex-col gap-2">
                 <div className="flex items-center gap-2 text-xs font-semibold text-purple-400 uppercase tracking-wider">
                    <Video className="w-3 h-3" />
                    <span>视频生成描述 (剧情完整性)</span>
                 </div>
                 {isEditing ? (
                    <div className="flex flex-col gap-2">
                        {/* Video AI Refine Tool */}
                         <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={videoAiInstruction}
                                onChange={(e) => setVideoAiInstruction(e.target.value)}
                                placeholder="让 AI 修改视频描述..." 
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:border-purple-500 outline-none placeholder:text-slate-600"
                                onKeyDown={(e) => e.key === 'Enter' && handleVideoAiRefine()}
                            />
                            <button 
                                onClick={handleVideoAiRefine}
                                disabled={isRefining || !videoAiInstruction.trim()}
                                className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 min-w-[80px] justify-center"
                            >
                                {isRefining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                AI 润色
                            </button>
                         </div>
                        <textarea 
                            value={localVideoPrompt} 
                            onChange={(e) => setLocalVideoPrompt(e.target.value)} 
                            className="w-full bg-slate-900 text-slate-200 text-sm p-3 rounded-lg border border-blue-500/50 focus:border-blue-500 outline-none min-h-[100px]"
                            placeholder="描述视频中发生的所有动作..."
                        />
                    </div>
                 ) : (
                    <div className="w-full bg-slate-900/30 text-slate-300 text-sm p-3 rounded-lg border border-transparent min-h-[80px]">
                        {scene.visualPrompt}
                    </div>
                 )}
              </div>

               {/* Image Prompt (New) */}
               <div className="flex flex-col gap-2">
                 <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                    <Camera className="w-3 h-3" />
                    <span>首帧画面描述 (静态构图)</span>
                 </div>
                 {isEditing ? (
                    <div className="flex flex-col gap-2">
                         {/* Image AI Refine Tool */}
                         <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={imageAiInstruction}
                                onChange={(e) => setImageAiInstruction(e.target.value)}
                                placeholder="让 AI 修改首帧描述 (例如: 更暗一点)..." 
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:border-emerald-500 outline-none placeholder:text-slate-600"
                                onKeyDown={(e) => e.key === 'Enter' && handleImageAiRefine()}
                            />
                            <button 
                                onClick={handleImageAiRefine}
                                disabled={isRefining || !imageAiInstruction.trim()}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 min-w-[80px] justify-center"
                            >
                                {isRefining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                AI 润色
                            </button>
                         </div>
                        <textarea 
                            value={localImagePrompt} 
                            onChange={(e) => setLocalImagePrompt(e.target.value)} 
                            className="w-full bg-slate-900 text-slate-200 text-xs p-3 rounded-lg border border-emerald-500/50 focus:border-emerald-500 outline-none min-h-[60px]"
                            placeholder="描述第一帧的画面构图..."
                        />
                    </div>
                 ) : (
                    <div className="w-full bg-slate-900/30 text-slate-400 text-xs p-3 rounded-lg border border-transparent min-h-[40px]">
                        {scene.imagePrompt || "（未设置首帧描述）"}
                    </div>
                 )}
              </div>
          </div>

          {/* Assets Section */}
          <div className="grid grid-cols-2 gap-4 mt-auto">
            <div className="bg-slate-900/30 p-3 rounded-lg border border-slate-700/30 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                 <span className="font-semibold uppercase tracking-wider flex items-center gap-1"><Upload className="w-3 h-3" /> 风格参考</span>
                 {scene.styleReferenceImage && (
                   <button onClick={() => fileInputRef.current?.click()} className="hover:text-white text-[10px] underline">更换</button>
                 )}
              </div>
              <div className={`relative aspect-video rounded border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden group transition-colors ${scene.styleReferenceImage ? 'border-transparent' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/50'}`} onClick={() => !scene.styleReferenceImage && fileInputRef.current?.click()}>
                 <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept="image/*" />
                 {scene.styleReferenceImage ? <img src={scene.styleReferenceImage} alt="Reference" className="w-full h-full object-cover" /> : <div className="text-center p-2"><ImageIcon className="w-6 h-6 text-slate-600 mx-auto mb-1 group-hover:text-slate-400" /><span className="text-[10px] text-slate-500">上传图片</span></div>}
              </div>
            </div>

            <div className="bg-slate-900/30 p-3 rounded-lg border border-slate-700/30 flex flex-col gap-2 relative">
              <div className="flex items-center justify-between text-xs text-slate-400">
                 <span className="font-semibold uppercase tracking-wider flex items-center gap-1"><ImageIcon className="w-3 h-3" /> 起始帧</span>
                 {/* Only show 'Regenerate' if we have an image AND not currently generating */}
                 {scene.generatedImage && onGenerateFirstFrame && scene.imageStatus !== 'generating' && (
                     <button onClick={handleImageGenerateClick} className="text-purple-400 hover:text-purple-300 text-[10px] underline">
                        重生成
                     </button>
                 )}
              </div>
              
              <div className="relative aspect-video rounded bg-black flex items-center justify-center overflow-hidden border border-slate-800">
                    {/* Error State for Image Generation */}
                    {scene.imageStatus === 'error' ? (
                       <div className="flex flex-col items-center justify-center p-2 text-center w-full h-full bg-slate-900">
                          <AlertCircle className="w-4 h-4 text-red-500 mb-1" />
                          <span className="text-[8px] text-red-400 line-clamp-2">{scene.imageErrorMessage || "生成失败"}</span>
                          {onGenerateFirstFrame && (
                              <button onClick={handleImageGenerateClick} className="mt-1 text-[9px] bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded flex items-center gap-1">
                                  <RefreshCw className="w-3 h-3" /> 重试
                              </button>
                          )}
                       </div>
                    ) : scene.imageStatus === 'generating' ? (
                       <div className="flex flex-col items-center justify-center">
                          <Loader2 className="w-5 h-5 text-purple-500 animate-spin mb-1" />
                          <span className="text-[8px] text-slate-500">生成中...</span>
                       </div>
                    ) : scene.generatedImage ? (
                        <img src={scene.generatedImage} alt="Start Frame" className="w-full h-full object-cover" />
                    ) : (
                        // Empty state with generation button
                        <div className="flex flex-col items-center justify-center gap-2 p-4 h-full w-full">
                            {onGenerateFirstFrame && scene.imageStatus === 'idle' ? (
                                <button 
                                    onClick={handleImageGenerateClick}
                                    className="flex flex-col items-center gap-1 text-slate-500 hover:text-purple-400 transition-colors group"
                                >
                                    <div className="p-2 rounded-full bg-slate-800 group-hover:bg-slate-700 border border-slate-700 group-hover:border-purple-500/50 transition-all">
                                        <Wand className="w-4 h-4" />
                                    </div>
                                    <span className="text-[10px] font-medium">生成首帧</span>
                                </button>
                            ) : (
                                <div className="text-center opacity-30">
                                    <ImageIcon className="w-5 h-5 text-slate-600 mx-auto mb-1" />
                                    <span className="text-[8px] text-slate-500">未设置</span>
                                </div>
                            )}
                        </div>
                    )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Video Preview */}
        <div className="col-span-1 lg:col-span-5 bg-slate-900/30 p-6 flex flex-col items-center justify-center relative min-h-[350px]">
            {scene.status === 'completed' && scene.videoUrl && (
                <div className={`flex flex-col gap-3 ${isPortrait ? 'w-auto' : 'w-full h-full'}`}>
                    <video src={scene.videoUrl} controls className={`rounded-lg shadow-lg border border-slate-700 bg-black object-cover ${isPortrait ? 'h-[400px] aspect-[9/16] mx-auto' : 'w-full aspect-video'}`} />
                    <a href={scene.videoUrl} download={`scene-${scene.id}.mp4`} className="w-full py-2 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-md transition-colors"><Download className="w-4 h-4" /> 下载视频</a>
                </div>
            )}
            {scene.status === 'generating_video' && (
                <div className="flex flex-col items-center justify-center text-center p-4 animate-pulse">
                    <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-3" />
                    <p className="text-slate-200 font-medium">视频生成中...</p>
                    <p className="text-slate-500 text-xs mt-1">{scene.generatedImage ? "根据起始帧生成..." : "文生视频..."}</p>
                </div>
            )}
            {scene.status === 'error' && (
                <div className="flex flex-col items-center justify-center text-center p-4">
                    <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
                    <p className="text-red-400 font-medium text-sm">生成失败</p>
                    <p className="text-slate-500 text-xs mt-1 max-w-[260px]">{scene.errorMessage}</p>
                    <button onClick={handleVideoGenerateClick} className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-full transition-colors">重试</button>
                </div>
            )}
            {scene.status === 'idle' && (
                <div className="flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 border border-slate-700 group-hover:border-purple-500/50 transition-colors"><Play className="w-6 h-6 text-slate-500" /></div>
                    <button onClick={handleVideoGenerateClick} className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-full shadow-lg transition-all transform hover:-translate-y-0.5">{scene.generatedImage ? '接续生成视频' : '生成视频'}</button>
                    <p className="text-slate-500 text-xs mt-3">{scene.generatedImage ? '图生视频' : '文生视频'}</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default SceneCard;
