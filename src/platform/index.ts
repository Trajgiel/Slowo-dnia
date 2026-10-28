// platform layer (architecture/react-port/modules.md in the workspace).
export { disableScrollRestoration, reloadPage, scrollIntoCenter, scrollToTop } from './page'
export {
  primeVoices,
  speak,
  SPEECH_LANG,
  SPEECH_RATE,
  type SpeakResult,
  type SpeechHost,
} from './speech'
export { applyTheme, THEME_COLOR } from './theme'
export { canShare, copyText, shareText, type ShareHost } from './share'
export {
  registerServiceWorker,
  shouldRegisterServiceWorker,
  type ServiceWorkerEnv,
  type ServiceWorkerHost,
} from './serviceWorker'
