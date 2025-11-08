import { useState, useEffect, useRef } from 'react';
import {
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Moon,
  Sun,
  Settings,
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(
    localStorage.getItem('voice') === 'on'
  );
  const [isSpeaking, setIsSpeaking] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const apiKey =
    import.meta.env.VITE_OPENROUTER_API_KEY || 'sk-or-yourapikeyhere';

  // 🌙 Initialize theme + speech recognition
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') setIsDarkMode(true);

    const welcomeMessage: Message = {
      id: 'welcome',
      role: 'assistant',
      content: " Hello! I'm Alex, your AI Medical Assistant. How can I help you today?",
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition =
        (window as any).webkitSpeechRecognition ||
        (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage(transcript);
        setIsListening(false);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  // 💾 Persist voice state
  useEffect(() => {
    localStorage.setItem('voice', isVoiceEnabled ? 'on' : 'off');
  }, [isVoiceEnabled]);

  // 🗣️ Speak function
  const speakText = (text: string) => {
    if (!isVoiceEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(
      text.replace(/Medical Disclaimer:/gi, '')
    );
    utter.rate = 0.9;
    utter.pitch = 1.1;

    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);

    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => v.name.includes('Samantha') || v.name.includes('Karen')) ||
      voices.find((v) => v.lang.includes('en'));
    if (preferred) utter.voice = preferred;

    window.speechSynthesis.speak(utter);
  };

  // 🧠 AI response
  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are Alex, an AI Medical Assistant. Provide educational, safe health information.',
            },
            { role: 'user', content: inputMessage },
          ],
        }),
      });

      const data = await response.json();
      const reply =
        data?.choices?.[0]?.message?.content ||
        "Sorry, I couldn’t generate a response right now.";

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      speakText(reply);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // 🎙️ Voice input toggle
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition not supported in your browser.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // 🧩 Stop speaking when turning off voice
  const toggleVoice = () => {
    if (isVoiceEnabled) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    setIsVoiceEnabled((prev) => !prev);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div className={`${isDarkMode ? 'dark bg-gray-900' : 'bg-gray-50'} min-h-screen`}>
      <div className="max-w-5xl mx-auto h-screen flex flex-col">
        {/* Header */}
        <header
          className={`${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          } border-b px-6 py-4 flex items-center justify-between shadow-sm`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full ${
                isDarkMode ? 'bg-blue-600' : 'bg-blue-500'
              } flex items-center justify-center text-white font-bold`}
            >
              AI
            </div>
            <div>
              <h1
                className={`text-xl font-bold ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}
              >
                AI MedBot - Alex
              </h1>
              <p
                className={`text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                Powered by OpenRouter
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className={`p-2 rounded-lg ${
                isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <Settings size={20} />
            </button>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-lg ${
                isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        {/* Chat */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-md ${
                  msg.role === 'user'
                    ? isDarkMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-500 text-white'
                    : isDarkMode
                    ? 'bg-gray-800 text-gray-100'
                    : 'bg-white text-gray-800'
                }`}
              >
                <div className="text-xs mb-1 opacity-70">
                  {msg.role === 'user' ? 'You' : 'Alex'} • {formatTime(msg.timestamp)}
                </div>
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {msg.role === 'assistant' && (
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <button
                      onClick={() => speakText(msg.content)}
                      disabled={!isVoiceEnabled}
                      className={`flex items-center gap-1 ${
                        !isVoiceEnabled
                          ? 'opacity-50 cursor-not-allowed'
                          : isDarkMode
                          ? 'text-blue-400 hover:text-blue-300'
                          : 'text-blue-600 hover:text-blue-700'
                      }`}
                    >
                      <Volume2 size={14} /> Listen
                    </button>

                    <button
                      onClick={toggleVoice}
                      className={`flex items-center gap-1 ${
                        isVoiceEnabled
                          ? isDarkMode
                            ? 'text-green-400 hover:text-green-300'
                            : 'text-green-600 hover:text-green-700'
                          : isDarkMode
                          ? 'text-gray-500 hover:text-gray-300'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                      title={isVoiceEnabled ? 'Turn Off Voice' : 'Turn On Voice'}
                    >
                      {isVoiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                      {isVoiceEnabled
                        ? isSpeaking
                          ? 'Speaking...'
                          : 'On'
                        : 'Off'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div
                className={`${
                  isDarkMode ? 'bg-gray-800' : 'bg-white'
                } rounded-2xl px-5 py-3 shadow-md`}
              >
                <span
                  className={`${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  Alex is thinking...
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          className={`${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          } border-t px-6 py-4`}
        >
          <form onSubmit={sendMessage} className="flex items-end gap-3">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask Alex a health question..."
              className={`flex-1 px-4 py-3 rounded-xl resize-none focus:outline-none focus:ring-2 ${
                isDarkMode
                  ? 'bg-gray-700 text-white placeholder-gray-400 focus:ring-blue-500'
                  : 'bg-gray-50 text-gray-900 placeholder-gray-500 focus:ring-blue-400'
              }`}
              rows={1}
            />

            <button
              type="button"
              onClick={toggleListening}
              className={`p-3 rounded-xl ${
                isListening
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : isDarkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            <button
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              className={`p-3 rounded-xl ${
                inputMessage.trim() && !isLoading
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : isDarkMode
                  ? 'bg-gray-700 text-gray-500'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
