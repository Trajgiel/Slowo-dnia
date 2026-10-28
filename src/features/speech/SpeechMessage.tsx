// The message under the screen when speech cannot use a Polish voice or is not available.
import { useTranslation } from 'react-i18next'
import type { SpeakResult } from '../../platform'

export function SpeechMessage({ result }: { readonly result: SpeakResult | null }) {
  const { t } = useTranslation()
  if (result === 'noVoice') return <div className="msg">{t('speech.noVoice')}</div>
  if (result === 'unsupported') return <div className="msg">{t('speech.unsupported')}</div>
  return null
}
