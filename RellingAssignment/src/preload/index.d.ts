import { ElectronAPI } from '@electron-toolkit/preload'

export interface VideoAPI {
  listVideos: () => Promise<any[]>
  importVideo: () => Promise<any>
  extractMetadata: (video_id: string) => Promise<{ ok: true }>
  getVideo: (video_id: string) => Promise<any>
  setVideoStatus: (video_id: string, status: 'Approved' | 'Rejected' | 'Pending') => Promise<any>
  getOriginalUrl: (video_id: string) => Promise<string>
  getClipJob: (video_id: string) => Promise<any>
  listClips: (video_id: string) => Promise<any[]>
  generateClips: (video_id: string) => Promise<{ ok: true }>
  backfillClipMetadata: (video_id: string) => Promise<{ ok: true; scanned: number; upserted: number }>
  getClipUrl: (video_id: string, clip_index: number) => Promise<string>
  revealVideoDir: (video_id: string) => Promise<{ ok: true }>
  revealClipsDir: (video_id: string) => Promise<{ ok: true }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: VideoAPI
  }
}
