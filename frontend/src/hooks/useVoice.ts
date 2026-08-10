import { useState, useEffect, useCallback, useRef } from 'react'

interface VoiceState {
  isListening: boolean
  transcript: string
  isSupported: boolean
  error: string | null
}

export function useVoice() {
  const [state, setState] = useState<VoiceState>({
    isListening: false,
    transcript: '',
    isSupported: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
    error: null,
  })

  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    if (!state.isSupported) return

    const SpeechRecognitionAPI =
      (window as typeof window & { webkitSpeechRecognition: { new (): SpeechRecognition } }).webkitSpeechRecognition ||
      (window as typeof window & { SpeechRecognition: { new (): SpeechRecognition } }).SpeechRecognition

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join('')
      setState((s) => ({ ...s, transcript }))
    }

    recognition.onend = () => {
      setState((s) => ({ ...s, isListening: false }))
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setState((s) => ({ ...s, isListening: false, error: event.error }))
    }

    recognitionRef.current = recognition

    return () => {
      recognition.abort()
    }
  }, [state.isSupported])

  const startListening = useCallback(() => {
    if (recognitionRef.current && !state.isListening) {
      setState((s) => ({ ...s, transcript: '', error: null, isListening: true }))
      recognitionRef.current.start()
    }
  }, [state.isListening])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && state.isListening) {
      recognitionRef.current.stop()
    }
  }, [state.isListening])

  const clearTranscript = useCallback(() => {
    setState((s) => ({ ...s, transcript: '' }))
  }, [])

  return {
    ...state,
    startListening,
    stopListening,
    clearTranscript,
  }
}
