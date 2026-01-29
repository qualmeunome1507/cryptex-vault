import { useState } from 'react'
import { Shield, Unlock, Lock, FileUp, Download, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { encryptFile, decryptFile } from './crypto'

export default function App() {
    const [mode, setMode] = useState<'encrypt' | 'decrypt'>('encrypt')
    const [password, setPassword] = useState('')
    const [file, setFile] = useState<File | null>(null)
    const [showPassword, setShowPassword] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)

    const handleAction = async () => {
        if (!file || !password) return

        setIsProcessing(true)
        setStatus(null)

        try {
            if (mode === 'encrypt') {
                const encryptedBlob = await encryptFile(file, password)
                const url = URL.createObjectURL(encryptedBlob)
                const link = document.createElement('a')
                link.href = url
                link.download = `${file.name}.ctx`
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                URL.revokeObjectURL(url)
                setStatus({ type: 'success', message: 'Arquivo criptografado com sucesso!' })
            } else {
                const decryptedFile = await decryptFile(file, password, file.name.replace('.ctx', ''), 'application/octet-stream')
                const url = URL.createObjectURL(decryptedFile)
                const link = document.createElement('a')
                link.href = url
                link.download = decryptedFile.name
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                URL.revokeObjectURL(url)
                setStatus({ type: 'success', message: 'Arquivo decriptografado com sucesso!' })
            }
        } catch (err: any) {
            setStatus({ type: 'error', message: err.message || 'Ocorreu um erro inesperado.' })
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <div className="app-container">
            <div className="glass-panel main-vault">
                <header className="header">
                    <div className="logo">
                        <Shield className="logo-icon" />
                        <h1>Cryptex Vault</h1>
                    </div>
                    <p className="subtitle">Criptografia AES-256-GCM Grau Militar</p>
                </header>

                <div className="mode-selector">
                    <button
                        className={mode === 'encrypt' ? 'active' : ''}
                        onClick={() => setMode('encrypt')}
                    >
                        <Lock size={18} /> Criptografar
                    </button>
                    <button
                        className={mode === 'decrypt' ? 'active' : ''}
                        onClick={() => setMode('decrypt')}
                    >
                        <Unlock size={18} /> Decriptografar
                    </button>
                </div>

                <main className="form-area">
                    <div className="input-group">
                        <label htmlFor="file-upload" className="drop-zone">
                            <FileUp className="drop-icon" />
                            <span>{file ? file.name : 'Selecione ou arraste um arquivo'}</span>
                            <input
                                id="file-upload"
                                type="file"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                hidden
                            />
                        </label>
                    </div>

                    <div className="input-group">
                        <div className="password-wrapper">
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Senha de segurança"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                className="eye-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <AnimatePresence>
                        {status && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className={`status-message ${status.type}`}
                            >
                                {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                {status.message}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button
                        className={`action-btn ${isProcessing ? 'loading' : ''}`}
                        disabled={!file || !password || isProcessing}
                        onClick={handleAction}
                    >
                        {isProcessing ? 'Processando...' : (mode === 'encrypt' ? 'Proteger Arquivo' : 'Desbloquear Arquivo')}
                    </button>
                </main>

                <footer className="footer-info">
                    <p>Tudo processado offline. Seus dados nunca saem do navegador.</p>
                </footer>
            </div>

            <div className="background-decor">
                <div className="circle-1"></div>
                <div className="circle-2"></div>
            </div>
        </div>
    )
}
