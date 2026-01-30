import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  listVideos: () => ipcRenderer.invoke('videos:list'),
  importVideo: () => ipcRenderer.invoke('videos:import'),
  extractMetadata: (video_id: string) => ipcRenderer.invoke('videos:extractMetadata', video_id),
  getVideo: (video_id: string) => ipcRenderer.invoke('videos:get', video_id),
  setVideoStatus: (video_id: string, status: 'Approved' | 'Rejected' | 'Pending') =>
    ipcRenderer.invoke('videos:setStatus', video_id, status),
  deleteVideos: (video_ids: string[]) => ipcRenderer.invoke('videos:delete', video_ids),
  getOriginalUrl: (video_id: string) => ipcRenderer.invoke('videos:getOriginalUrl', video_id),
  getClipJob: (video_id: string) => ipcRenderer.invoke('clips:getJob', video_id),
  listClips: (video_id: string) => ipcRenderer.invoke('clips:list', video_id),
  generateClips: (video_id: string) => ipcRenderer.invoke('clips:generate', video_id),
  backfillClipMetadata: (video_id: string) => ipcRenderer.invoke('clips:backfillMetadata', video_id),
  getClipUrl: (video_id: string, clip_index: number) => ipcRenderer.invoke('clips:getUrl', video_id, clip_index),
  revealVideoDir: (video_id: string) => ipcRenderer.invoke('debug:revealVideoDir', video_id),
  revealClipsDir: (video_id: string) => ipcRenderer.invoke('debug:revealClipsDir', video_id)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
