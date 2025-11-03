import { useState, useEffect, useRef } from 'react';
import {
  Send,
  Mic,
  MicOff,
  Volume2,
  Moon,
  Sun,
  Settings,
  X,
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // ✅ Hardcoded or ENV-based API Key
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY || 'sk-or-yourapikeyhere';

  // On load
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') setIsDarkMode(true);

    const welcomeMessage: Message = {
      id: 'welcome',
      role: 'assistant',
      content:
        "👋 Hello! I'm Alex, your AI Medical Assistant. I can provide general health education and wellness information — not diagnosis or prescriptions. How can I help you today?",
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);

    // Speech recognition setup
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition =
        (window as any).webkitSpeechRecognition ||
        (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

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

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[]/g, '').replace(/Medical Disclaimer:/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);

      const voices = window.speechSynthesis.getVoices();
      const femaleVoice =
        voices.find(v => v.name.includes('Samantha') || v.name.includes('Karen')) ||
        voices.find(v => v.lang.includes('en'));

      if (femaleVoice) utterance.voice = femaleVoice;
      utterance.rate = 0.9;
      utterance.pitch = 1.1;

      window.speechSynthesis.speak(utterance);
    }
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      let reply = '';

      // 🧠 Detect symptom-type query
      const symptomKeywords = ["fever", "pain", "cough", "headache", "nausea", "vomit", "cold", "sore throat", "fatigue", "chest"];
      const lowerMsg = inputMessage.toLowerCase();

      const isSymptomQuery = symptomKeywords.some(word => lowerMsg.includes(word));

      if (isSymptomQuery) {
        // ✅ Call your local ML API
        const mlResponse = await fetch("http://127.0.0.1:8000/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symptoms: inputMessage })
        });
        const mlData = await mlResponse.json();
        reply = `🤖 Based on your symptoms, you may be showing signs related to: **${mlData.prediction}**.\n\n(Please consult a doctor for a professional opinion.)`;
      } else {
        // 🌐 Default: Use OpenRouter AI
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": window.location.origin,
            "X-Title": "AI MedBot - Alex",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are Alex, an AI Medical Assistant. Provide educational, non-diagnostic responses about health and wellness." },
              { role: "user", content: inputMessage },
            ],
          }),
        });

        const data = await response.json();
        reply =
          data?.choices?.[0]?.message?.content ||
          "Sorry, I couldn't generate a response right now.";
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: reply,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      speakText(reply);
    } catch (error) {
      console.error("Error:", error);
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "⚠️ Could not connect to ML server or OpenRouter. Please check your connections.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };


  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-50'}`}>
      <div className="max-w-5xl mx-auto h-screen flex flex-col">

        {/* Header */}
        <header className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4 flex items-center justify-between shadow-sm`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${isDarkMode ? 'bg-blue-600' : 'bg-blue-500'} flex items-center justify-center text-white font-bold`}>AI</div>
            <div>
              <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>AI MedBot - Alex</h1>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Powered by OpenRouter</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}>
              <Settings size={20} />
            </button>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}>
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
              <div className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-md ${msg.role === 'user'
                ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
                : (isDarkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800')}`}>
                <div className="text-xs mb-1 opacity-70">
                  {msg.role === 'user' ? 'You' : 'Alex'} • {formatTime(msg.timestamp)}
                </div>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => speakText(msg.content)}
                    className={`mt-2 text-xs flex items-center gap-1 ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}>
                    <Volume2 size={14} /> Listen
                  </button>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start animate-fadeIn">
              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl px-5 py-3 shadow-md`}>
                <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Alex is thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Box */}
        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-t px-6 py-4`}>
          <form onSubmit={sendMessage} className="flex items-end gap-3">
            <textarea
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask Alex a health question..."
              className={`flex-1 px-4 py-3 rounded-xl resize-none focus:outline-none focus:ring-2 ${isDarkMode
                ? 'bg-gray-700 text-white placeholder-gray-400 focus:ring-blue-500'
                : 'bg-gray-50 text-gray-900 placeholder-gray-500 focus:ring-blue-400'}`}
              rows={1}
            />

            <button
              type="button"
              onClick={toggleListening}
              className={`p-3 rounded-xl ${isListening
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : isDarkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            <button
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              className={`p-3 rounded-xl ${inputMessage.trim() && !isLoading
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : isDarkMode
                  ? 'bg-gray-700 text-gray-500'
                  : 'bg-gray-100 text-gray-400'}`}>
              <Send size={20} />
            </button>
          </form>
          <p className={`text-xs text-center mt-3 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>

      {/* Settings Modal (now simplified) */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 max-w-md w-full shadow-2xl`}>
            <div className="flex justify-between mb-4">
              <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Settings</h2>
              <button onClick={() => setShowSettings(false)}><X size={20} /></button>
            </div>
            <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              The API key is securely loaded from the environment file.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
