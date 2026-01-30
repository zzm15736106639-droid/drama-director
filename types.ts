
export interface Scene {
  id: string;
  scriptSegment: string;
  visualPrompt: string; // Video prompt
  imagePrompt?: string; // First frame generation prompt (New)
  videoUrl?: string;
  styleReferenceImage?: string; // Data URL for user uploaded reference
  generatedImage?: string;      // Data URL for AI generated first frame
  
  // Video / Main Status
  status: 'idle' | 'generating_video' | 'completed' | 'error';
  errorMessage?: string;

  // Image Generation Status (Decoupled)
  imageStatus: 'idle' | 'generating' | 'completed' | 'error';
  imageErrorMessage?: string;

  aspectRatio?: '16:9' | '9:16';
}

export interface GeneratedSceneResponse {
  script_segment: string;
  visual_prompt: string;
  image_prompt: string; // Added image prompt to response
}

export interface ScriptAnalysis {
  pacing_suggestion: string;
  tone_analysis: string;
  character_arcs: { name: string; arc: string }[];
  suggested_breaks: { segment: string; reasoning: string }[];
}

// Global declaration for the AI Studio key selection
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}
