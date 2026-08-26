'use client';

import { useRef, useState } from 'react';

export default function MicButton({ onResult }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);

  function toggle() {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (transcript) onResult(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch (err) {
      setListening(false);
    }
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      className={`mic-btn ${listening ? 'listening' : ''}`}
      onClick={toggle}
      title={listening ? 'Listening… tap to stop' : 'Speak to type'}
    >
      {listening ? '■' : '🎤'}
    </button>
  );
}
