'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MessageCircle, Send, Loader2, Sparkles, Plus, Trash2 } from 'lucide-react'
import { logger } from '@/lib/logger'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatSession {
  id: string
  title: string | null
  lastActiveAt: string
}

export default function ChatPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSession, setCurrentSession] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    fetchSessions()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/astrology/chat')
      if (response.ok) {
        const data = await response.json()
        setSessions(data.chats || [])
      }
    } catch (err) {
      logger.warn('Failed to fetch sessions')
    }
  }

  const createNewSession = () => {
    setCurrentSession(null)
    setMessages([])
    if (window.innerWidth < 768) {
      setSidebarOpen(false)
    }
  }

  const loadSession = async (sessionId: string) => {
    setCurrentSession(sessionId)
    setLoading(true)

    // For now, start fresh - in production, fetch messages from API
    setMessages([])

    if (window.innerWidth < 768) {
      setSidebarOpen(false)
    }

    setLoading(false)
  }

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      // In production, call API to delete
      setSessions(sessions.filter((s) => s.id !== sessionId))
      if (currentSession === sessionId) {
        setCurrentSession(null)
        setMessages([])
      }
    } catch (err) {
      logger.warn('Failed to delete session')
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/astrology/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId: currentSession,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send message')
      }

      const data = await response.json()

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
      setCurrentSession(data.sessionId)

      // Update session list
      if (!sessions.find((s) => s.id === data.sessionId)) {
        fetchSessions()
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${err.message}`,
          timestamp: new Date(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 hover:bg-white/10 rounded-lg"
              >
                <MessageCircle className="w-5 h-5" />
              </button>
              <Link href="/" className="flex items-center gap-2">
                <Sparkles className="w-8 h-8 text-purple-400" />
                <span className="text-xl font-bold gradient-text">StarPath Astrology</span>
              </Link>
            </div>
            <Link href="/dashboard" className="text-purple-200 hover:text-white transition">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-16 flex h-screen">
        {/* Sidebar */}
        <div
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed md:relative z-40 w-64 h-full glass border-r border-purple-500/20 transition-transform md:translate-x-0`}
        >
          <div className="p-4">
            <button
              onClick={createNewSession}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-xl transition"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </button>
          </div>

          <div className="overflow-y-auto h-[calc(100%-80px)]">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => loadSession(session.id)}
                className={`group flex items-center gap-2 mx-2 my-1 p-3 rounded-xl cursor-pointer transition ${
                  currentSession === session.id
                    ? 'bg-purple-600/30'
                    : 'hover:bg-white/5'
                }`}
              >
                <MessageCircle className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <span className="flex-1 truncate text-sm">
                  {session.title || 'New Conversation'}
                </span>
                <button
                  onClick={(e) => deleteSession(session.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md">
                  <div className="w-20 h-20 rounded-full bg-purple-600/30 flex items-center justify-center mx-auto mb-6">
                    <MessageCircle className="w-10 h-10 text-purple-400" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2 gradient-text">
                    Chat with Your AI Astrologer
                  </h2>
                  <p className="text-purple-200 mb-6">
                    Ask anything about your birth chart, transits, compatibility,
                    or get guidance on any life topic through an astrological lens.
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 bg-white/5 rounded-xl text-left">
                      <span className="text-purple-400">💡</span> What does my Sun sign mean?
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl text-left">
                      <span className="text-purple-400">💕</span> Is my partner compatible with me?
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl text-left">
                      <span className="text-purple-400">💼</span> What career suits my chart?
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl text-left">
                      <span className="text-purple-400">🌟</span> What transits am I experiencing?
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-4">
                {messages.map((message, i) => (
                  <div
                    key={i}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-4 rounded-2xl ${
                        message.role === 'user'
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/10'
                      }`}
                    >
                      {message.content.split('\n').map((line, j) => (
                        <p key={j} className={j > 0 ? 'mt-2' : ''}>{line}</p>
                      ))}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white/10 p-4 rounded-2xl flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                      <span className="text-purple-300">Consulting the stars...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-purple-500/20 p-4">
            <form onSubmit={sendMessage} className="max-w-3xl mx-auto flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask your AI astrologer anything..."
                className="flex-1 px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-purple-400"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-purple-600 hover:bg-purple-500 disabled:bg-purple-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl transition flex items-center gap-2"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
