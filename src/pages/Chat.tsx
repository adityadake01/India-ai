import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Bot, User, Loader2, Mic, MicOff, Image as ImageIcon, Video, MessageSquare } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../lib/firebase';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, uploadBytes } from 'firebase/storage';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  type?: 'text' | 'image' | 'video';
  mediaUrl?: string;
}

type Mode = 'text' | 'image' | 'video';

export const Chat: React.FC = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('text');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load chat history
  useEffect(() => {
    const loadChat = async () => {
      if (chatId) {
        const docRef = doc(db, 'chats', chatId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setMessages(data.messages || []);
          setMode(data.mode || 'text');
        }
      } else {
        setMessages([]);
      }
    };
    loadChat();
  }, [chatId]);

  const getValidApiKey = async () => {
    // @ts-ignore
    if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
      // @ts-ignore
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
      }
      // @ts-ignore
      const hasKeyAfter = await window.aistudio.hasSelectedApiKey();
      if (!hasKeyAfter) {
        throw new Error("API Key is required for Image/Video generation.");
      }
    }
    return process.env.API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'mr-IN'; // Marathi default
    recognition.continuous = false;
    recognition.interimResults = true;
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognition.start();
    setIsListening(true);
    recognitionRef.current = recognition;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      type: 'text'
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      let aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: '',
        type: mode
      };

      if (mode === 'text') {
        const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });
        const contents = newMessages.map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        }));
        
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: contents,
          config: {
            systemInstruction: "You are an expert on Indian General Knowledge (GK). You can speak Marathi, Hindi, and English. Provide accurate, helpful, and concise answers.",
          }
        });
        aiMessage.content = response.text || "Sorry, I couldn't generate a response.";
        
      } else if (mode === 'image') {
        const apiKey = await getValidApiKey();
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-image-preview',
          contents: userMessage.content,
        });
        
        let base64Data = '';
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            base64Data = part.inlineData.data;
            break;
          }
        }
        
        if (base64Data) {
          try {
            const storageRef = ref(storage, `media/${user?.uid}/${Date.now()}.png`);
            await uploadString(storageRef, base64Data, 'base64', { contentType: 'image/png' });
            aiMessage.mediaUrl = await getDownloadURL(storageRef);
            aiMessage.content = "Here is your generated image.";
          } catch (err) {
            console.warn("Storage failed, using local URL", err);
            aiMessage.mediaUrl = `data:image/png;base64,${base64Data}`;
            aiMessage.content = "Here is your generated image (not saved to cloud).";
          }
        } else {
          aiMessage.content = "Failed to generate image.";
        }
        
      } else if (mode === 'video') {
        const apiKey = await getValidApiKey();
        const ai = new GoogleGenAI({ apiKey });
        let operation = await ai.models.generateVideos({
          model: 'veo-3.1-fast-generate-preview',
          prompt: userMessage.content,
          config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
        });
        
        aiMessage.content = "Generating video... This may take a few minutes.";
        setMessages([...newMessages, aiMessage]); // Show loading message early
        
        while (!operation.done) {
          await new Promise(resolve => setTimeout(resolve, 10000));
          operation = await ai.operations.getVideosOperation({ operation });
        }
        
        const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (uri) {
          try {
            const videoResponse = await fetch(uri, { headers: { 'x-goog-api-key': apiKey } });
            const blob = await videoResponse.blob();
            const videoRef = ref(storage, `media/${user?.uid}/${Date.now()}.mp4`);
            await uploadBytes(videoRef, blob, { contentType: 'video/mp4' });
            aiMessage.mediaUrl = await getDownloadURL(videoRef);
            aiMessage.content = "Here is your generated video.";
          } catch (err) {
            console.warn("Storage failed, using local URL", err);
            aiMessage.mediaUrl = uri;
            aiMessage.content = "Here is your generated video (link may expire).";
          }
        } else {
          aiMessage.content = "Failed to generate video.";
        }
      }

      const finalMessages = [...newMessages, aiMessage];
      setMessages(finalMessages);

      // Save to Firestore
      if (user) {
        if (chatId) {
          await updateDoc(doc(db, 'chats', chatId), {
            messages: finalMessages,
            updatedAt: serverTimestamp()
          });
        } else {
          // Generate title for new chat
          const titleAi = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });
          const titleRes = await titleAi.models.generateContent({
            model: 'gemini-3.1-flash-preview',
            contents: `Generate a short 3-4 word title for this query: "${userMessage.content}"`
          });
          const title = titleRes.text?.replace(/["']/g, '').trim() || 'New Chat';
          
          const docRef = await addDoc(collection(db, 'chats'), {
            userId: user.uid,
            title,
            mode,
            messages: finalMessages,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          navigate(`/c/${docRef.id}`, { replace: true });
        }
        
        // Also save query for admin
        await addDoc(collection(db, 'queries'), {
          userId: user.uid,
          userEmail: user.email,
          query: userMessage.content,
          mode: mode,
          timestamp: serverTimestamp(),
        });
      }

    } catch (error: any) {
      console.error('Error:', error);
      setMessages(prev => {
        // If we already added a loading message for video, replace it
        const filtered = prev.filter(m => m.content !== "Generating video... This may take a few minutes.");
        return [...filtered, {
          id: Date.now().toString(),
          role: 'model',
          content: `Error: ${error.message || 'Something went wrong.'}`,
          type: 'text'
        }];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Mode Selector */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-gray-100 p-1 rounded-full flex gap-1 shadow-sm border border-gray-200">
        <button onClick={() => setMode('text')} className={cn("px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors", mode === 'text' ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
          <MessageSquare className="w-3.5 h-3.5" /> Text
        </button>
        <button onClick={() => setMode('image')} className={cn("px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors", mode === 'image' ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
          <ImageIcon className="w-3.5 h-3.5" /> Image
        </button>
        <button onClick={() => setMode('video')} className={cn("px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors", mode === 'video' ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
          <Video className="w-3.5 h-3.5" /> Video
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pt-14 pb-24">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-gray-900" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">How can I help you today?</h2>
            <p className="text-sm text-gray-500 max-w-[250px]">
              Ask me anything about Indian General Knowledge, or generate images and videos!
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={cn("flex gap-3", msg.role === 'user' ? "justify-end" : "justify-start")}>
              {msg.role === 'model' && (
                <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              <div className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5",
                msg.role === 'user' ? "bg-gray-100 text-gray-900 rounded-tr-sm" : "bg-transparent text-gray-900"
              )}>
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</p>
                ) : (
                  <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-gray-100 prose-pre:text-gray-900">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    
                    {msg.mediaUrl && msg.type === 'image' && (
                      <img src={msg.mediaUrl} alt="Generated" className="mt-3 rounded-xl w-full max-w-sm border border-gray-200 shadow-sm" />
                    )}
                    
                    {msg.mediaUrl && msg.type === 'video' && (
                      <video src={msg.mediaUrl} controls className="mt-3 rounded-xl w-full max-w-sm border border-gray-200 shadow-sm" />
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-transparent px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-6 pb-4 px-4">
        <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-gray-100 rounded-3xl p-2 shadow-sm border border-gray-200 transition-all focus-within:ring-2 focus-within:ring-gray-900/20 focus-within:border-gray-400">
          <button 
            type="button" 
            onClick={toggleListening} 
            className={cn("p-2.5 rounded-full transition-colors flex-shrink-0 mb-0.5", isListening ? "bg-red-100 text-red-600" : "text-gray-500 hover:bg-gray-200 hover:text-gray-900")}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'text' ? "Message Indian GK..." : mode === 'image' ? "Describe an image to generate..." : "Describe a video to generate..."}
            className="flex-1 max-h-[120px] min-h-[40px] bg-transparent border-0 focus:ring-0 resize-none py-2.5 text-[15px] placeholder:text-gray-500"
            rows={1}
            disabled={isLoading}
          />
          
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2.5 bg-gray-900 text-white rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:hover:bg-gray-900 transition-colors flex-shrink-0 mb-0.5"
          >
            {isLoading && mode !== 'video' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
        <div className="text-center mt-2">
          <p className="text-[10px] text-gray-400">AI can make mistakes. Check important info.</p>
        </div>
      </div>
    </div>
  );
};
