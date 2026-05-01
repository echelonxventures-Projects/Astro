'use client'

import { useState, useRef } from 'react'
import { Upload, Sparkles, Loader2, Image as ImageIcon, Check, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'

export default function PalmistryPage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [reading, setReading] = useState<{
    handType: string
    lifeLine: string
    heartLine: string
    headLine: string
    fateLine: string
    overallReading: string
    recommendations: string[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('Image size should be less than 10MB')
        return
      }
      setError(null)
      const reader = new FileReader()
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string)
        setReading(null)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setError(null)
      const reader = new FileReader()
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string)
        setReading(null)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAnalyze = async () => {
    if (!selectedImage) return

    setIsAnalyzing(true)
    setError(null)

    try {
      const response = await fetch('/api/astrology/palmistry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: selectedImage }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to analyze palm')
      }

      const result = await response.json()
      setReading(result.reading)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze palm')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-amber-400 via-orange-400 to-pink-400 bg-clip-text text-transparent">
            Palm Reading
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Upload a clear photo of your palm to receive an AI-powered analysis of your life path,
            relationships, career prospects, and more.
          </p>
        </motion.div>

        {/* Upload Section */}
        {!selectedImage ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8"
          >
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-slate-700 hover:border-amber-500/50 rounded-xl p-12 text-center cursor-pointer transition-colors"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Upload className="w-10 h-10 text-amber-400" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-medium text-slate-200">
                    Upload Your Palm Photo
                  </p>
                  <p className="text-slate-400">
                    Drag and drop or click to browse
                  </p>
                  <p className="text-sm text-slate-500">
                    PNG, JPG up to 10MB
                  </p>
                </div>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />

            {/* Tips */}
            <div className="mt-8 grid md:grid-cols-3 gap-4">
              <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-400">
                  <Check className="w-4 h-4" />
                  <span className="font-medium text-sm">Good Lighting</span>
                </div>
                <p className="text-xs text-slate-400">
                  Ensure your palm is well-lit with no shadows
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-400">
                  <Check className="w-4 h-4" />
                  <span className="font-medium text-sm">Clear Focus</span>
                </div>
                <p className="text-xs text-slate-400">
                  Keep your hand steady for a sharp image
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-400">
                  <Check className="w-4 h-4" />
                  <span className="font-medium text-sm">Open Palm</span>
                </div>
                <p className="text-xs text-slate-400">
                  Show your full palm with fingers slightly spread
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6"
          >
            <div className="flex flex-col md:flex-row gap-6">
              {/* Image Preview */}
              <div className="md:w-1/2">
                <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-800">
                  <img
                    src={selectedImage}
                    alt="Palm"
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  onClick={() => {
                    setSelectedImage(null)
                    setReading(null)
                    setError(null)
                  }}
                  className="mt-4 w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                >
                  Upload Different Photo
                </button>
              </div>

              {/* Analysis Section */}
              <div className="md:w-1/2 flex flex-col">
                {!reading && !isAnalyzing && !error && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                    <ImageIcon className="w-12 h-12 text-slate-600" />
                    <p className="text-slate-400">Ready to analyze your palm</p>
                    <button
                      onClick={handleAnalyze}
                      className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium rounded-lg transition-all flex items-center gap-2"
                    >
                      <Sparkles className="w-5 h-5" />
                      Analyze Palm
                    </button>
                  </div>
                )}

                {isAnalyzing && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                    <Loader2 className="w-12 h-12 text-amber-400 animate-spin" />
                    <p className="text-slate-300">Analyzing your palm lines...</p>
                    <p className="text-sm text-slate-500">
                      This may take up to 30 seconds
                    </p>
                  </div>
                )}

                {error && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                    <AlertCircle className="w-12 h-12 text-red-400" />
                    <p className="text-red-400">{error}</p>
                    <button
                      onClick={() => setError(null)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                )}

                {reading && (
                  <div className="space-y-4 overflow-y-auto max-h-[500px] pr-2">
                    <div className="flex items-center gap-2 text-green-400">
                      <Check className="w-5 h-5" />
                      <span className="font-medium">Analysis Complete</span>
                    </div>

                    <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                      <div>
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Hand Type</span>
                        <p className="text-slate-200 font-medium">{reading.handType}</p>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Life Line</span>
                        <p className="text-slate-300 text-sm">{reading.lifeLine}</p>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Heart Line</span>
                        <p className="text-slate-300 text-sm">{reading.heartLine}</p>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Head Line</span>
                        <p className="text-slate-300 text-sm">{reading.headLine}</p>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Fate Line</span>
                        <p className="text-slate-300 text-sm">{reading.fateLine}</p>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg p-4">
                      <span className="text-xs text-amber-500 uppercase tracking-wider">Overall Reading</span>
                      <p className="text-slate-200 mt-2">{reading.overallReading}</p>
                    </div>

                    {reading.recommendations.length > 0 && (
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <span className="text-xs text-slate-500 uppercase tracking-wider mb-3 block">Recommendations</span>
                        <ul className="space-y-2">
                          {reading.recommendations.map((rec, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                              <span className="text-amber-400 mt-0.5">•</span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6"
        >
          <h2 className="text-xl font-semibold text-slate-200 mb-4">About Palm Reading</h2>
          <div className="grid md:grid-cols-2 gap-6 text-sm text-slate-400">
            <div>
              <h3 className="text-amber-400 font-medium mb-2">Major Lines Analyzed</h3>
              <ul className="space-y-1">
                <li>• <strong className="text-slate-300">Life Line:</strong> Vitality, health, life changes</li>
                <li>• <strong className="text-slate-300">Heart Line:</strong> Emotional life, relationships</li>
                <li>• <strong className="text-slate-300">Head Line:</strong> Intellect, communication style</li>
                <li>• <strong className="text-slate-300">Fate Line:</strong> Career path, life direction</li>
              </ul>
            </div>
            <div>
              <h3 className="text-amber-400 font-medium mb-2">Hand Types</h3>
              <ul className="space-y-1">
                <li>• <strong className="text-slate-300">Earth:</strong> Practical, reliable, grounded</li>
                <li>• <strong className="text-slate-300">Air:</strong> Intellectual, communicative</li>
                <li>• <strong className="text-slate-300">Fire:</strong> Energetic, passionate, spontaneous</li>
                <li>• <strong className="text-slate-300">Water:</strong> Emotional, intuitive, creative</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
