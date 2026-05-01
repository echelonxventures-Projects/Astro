'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Download, Trash2, Shield, AlertTriangle, Loader2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function DataRightsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleExportData = async () => {
    if (!session?.user) return

    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/gdpr/data')
      if (!response.ok) throw new Error('Failed to export data')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `starpath-data-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      window.URL.revokeObjectURL(url)

      setMessage({ type: 'success', text: 'Data exported successfully!' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to export data. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!session?.user) return
    if (deleteConfirmText !== 'DELETE') return

    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/gdpr/data', {
        method: 'DELETE',
        headers: {
          'X-Confirm-Delete': 'CONFIRM_ERASE',
        },
      })

      if (!response.ok) throw new Error('Failed to delete account')

      setMessage({ type: 'success', text: 'Account deleted successfully. You will be redirected.' })

      // Sign out and redirect
      setTimeout(() => {
        router.push('/')
      }, 2000)
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete account. Please try again.' })
    } finally {
      setLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  if (status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <Shield className="w-16 h-16 text-purple-400 mx-auto mb-4" />
          <h1 className="text-4xl font-bold gradient-text mb-2">Your Data Rights</h1>
          <p className="text-purple-200">
            Under GDPR, you have the right to access, export, and delete your personal data.
          </p>
        </motion.div>

        {message && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`mb-6 p-4 rounded-xl ${
              message.type === 'success'
                ? 'bg-green-900/30 border border-green-500/30 text-green-300'
                : 'bg-red-900/30 border border-red-500/30 text-red-300'
            }`}
          >
            {message.text}
          </motion.div>
        )}

        <div className="space-y-6">
          {/* Export Data Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-2xl p-6"
          >
            <div className="flex items-start gap-4">
              <Download className="w-10 h-10 text-purple-400 flex-shrink-0" />
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-white mb-2">Export Your Data</h2>
                <p className="text-purple-200 mb-4">
                  Download all your personal data stored with us. This includes your profile,
                  birth charts, readings, chat history, and payment records.
                </p>
                <p className="text-purple-400 text-sm mb-4">
                  Format: JSON file with all personal data
                </p>
                <button
                  onClick={handleExportData}
                  disabled={loading}
                  className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-500 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                  Export My Data
                </button>
              </div>
            </div>
          </motion.div>

          {/* Delete Account Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-2xl p-6 border border-red-500/20"
          >
            <div className="flex items-start gap-4">
              <Trash2 className="w-10 h-10 text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-white mb-2">Delete Your Account</h2>
                <p className="text-purple-200 mb-4">
                  Permanently delete your account and all associated data. This action is
                  irreversible and you will not be able to recover any data after deletion.
                </p>

                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-400 mb-2" />
                  <p className="text-red-300 text-sm">
                    Warning: This will permanently delete:
                  </p>
                  <ul className="text-red-400 text-sm mt-2 space-y-1">
                    <li>• Your profile and account credentials</li>
                    <li>• All saved birth charts and readings</li>
                    <li>• Chat history with AI astrologer</li>
                    <li>• Payment and subscription history</li>
                    <li>• Any stored preferences and settings</li>
                  </ul>
                </div>

                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-500 transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-5 h-5" />
                    Request Account Deletion
                  </button>
                ) : (
                  <div className="space-y-4">
                    <p className="text-white">
                      Type <span className="text-red-400 font-bold">DELETE</span> to confirm:
                    </p>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="Type DELETE"
                      className="w-full px-4 py-3 bg-[#1e1b4b] border border-purple-500/30 rounded-xl text-white focus:border-red-500 focus:outline-none"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-4 py-2 text-purple-300 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={loading || deleteConfirmText !== 'DELETE'}
                        className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-500 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                        Permanently Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Your Rights Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-2xl p-6"
          >
            <h2 className="text-xl font-semibold text-white mb-4">Your GDPR Rights</h2>
            <div className="grid md:grid-cols-2 gap-4 text-purple-200">
              <div>
                <h3 className="text-white font-medium mb-1">Right to Access</h3>
                <p className="text-sm">You can request a copy of all personal data we hold about you.</p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Right to Rectification</h3>
                <p className="text-sm">You can request correction of inaccurate personal data.</p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Right to Erasure</h3>
                <p className="text-sm">You can request deletion of your personal data.</p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Right to Portability</h3>
                <p className="text-sm">You can receive your data in a portable format.</p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Right to Restrict Processing</h3>
                <p className="text-sm">You can limit how we use your personal data.</p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Right to Object</h3>
                <p className="text-sm">You can object to certain types of processing.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}