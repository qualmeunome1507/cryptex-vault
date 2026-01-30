import { useState } from 'react'
import { Shield, Unlock, Lock, FileUp, Download, Eye, EyeOff, AlertCircle, CheckCircle2, Image as ImageIcon, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { encryptFile, decryptFile, wrapInImage, unwrapFromImage } from './crypto'

export default function App() {
    const [mode, setMode] = useState<'encrypt' | 'decrypt'>('encrypt')
    const [password, setPassword] = useState('')
    const [files, setFiles] = useState<File[]>([])
    const [showPassword, setShowPassword] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [progress, setProgress] = useState(0)
    const [currentFileIndex, setCurrentFileIndex] = useState(-1)
    const [isDone, setIsDone] = useState(false)
    const [isCamouflageMode, setIsCamouflageMode] = useState(false)

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragover' || e.type === 'dragenter') {
            setIsDragging(true)
        } else if (e.type === 'dragleave') {
            setIsDragging(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        const droppedFiles = Array.from(e.dataTransfer.files)
        if (droppedFiles.length > 0) {
            setFiles(droppedFiles.slice(0, 3))
        }
    }

    const getPasswordStrength = (pass: string) => {
        if (!pass) return { score: 0, label: '', color: 'transparent' }
        let score = 0
        if (pass.length > 8) score++
        if (pass.length > 12) score++
        if (/[A-Z]/.test(pass)) score++
        if (/[0-9]/.test(pass)) score++
        if (/[^A-Za-z0-9]/.test(pass)) score++

        const states = [
            { label: 'Muito Fraca', color: '#ff3e3e' },
            { label: 'Fraca', color: '#ff9d3e' },
            { label: 'Média', color: '#ffd53e' },
            { label: 'Forte', color: '#00ff88' },
            { label: 'Inabalável', color: '#00f2ff' }
        ]
        return { score, ...states[Math.min(score, 4)] }
    }

    const passwordStrength = getPasswordStrength(password)

    const handleAction = async () => {
        if (files.length === 0 || !password) return

        if (passwordStrength.score < 3) {
            setStatus({ type: 'error', message: 'Por favor, use uma senha mais forte (Média ou superior).' })
            return
        }

        setIsProcessing(true)
        setStatus(null)
        setProgress(0)
        setIsDone(false)

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                setCurrentFileIndex(i)
                setProgress(0)

                if (mode === 'encrypt') {
                    let encryptedBlob = await encryptFile(file, password, (p) => setProgress(p))

                    if (isCamouflageMode) {
                        encryptedBlob = await wrapInImage(encryptedBlob, '/cryptex-vault/carrier.png')
                    }

                    const url = URL.createObjectURL(encryptedBlob)
                    const link = document.createElement('a')
                    link.href = url
                    link.download = isCamouflageMode ? `IMAGEM ${i + 1}.png` : `IMAGEM ${i + 1}.ctx`
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                    URL.revokeObjectURL(url)
                } else {
                    const unwrappedBlob = await unwrapFromImage(file)
                    const decryptedFile = await decryptFile(unwrappedBlob, password, (p) => setProgress(p))
                    const url = URL.createObjectURL(decryptedFile)
                    const link = document.createElement('a')
                    link.href = url
                    link.download = decryptedFile.name
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                    URL.revokeObjectURL(url)
                }
            }
            setStatus({ type: 'success', message: `${files.length} arquivo(s) processado(s) com sucesso!` })
            setIsDone(true)
        } catch (err: any) {
            setStatus({ type: 'error', message: err.message || 'Ocorreu um erro inesperado.' })
        } finally {
            setIsProcessing(false)
            setCurrentFileIndex(-1)
            setProgress(0)
        }
    }

    const resetVault = () => {
        setFiles([])
        setPassword('')
        setStatus(null)
        setIsDone(false)
        setCurrentFileIndex(-1)
        setProgress(0)
    }

    return (
        <div className="app-container">
            <div className="ad-container top-ad">
                <div className="ad-placeholder">Espaço para Anúncio (Banner Superior)</div>
            </div>

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
                        <label
                            htmlFor="file-upload"
                            className={`drop-zone ${isDragging ? 'dragging' : ''}`}
                            onDragOver={handleDrag}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDrop={handleDrop}
                        >
                            <FileUp className="drop-icon" />
                            <span>{files.length > 0 ? `${files.length} arquivo(s) selecionado(s)` : 'Selecione ou arraste até 3 arquivos'}</span>
                            <span className="limit-notice">(Máximo de 3 arquivos por vez)</span>
                            <input
                                id="file-upload"
                                type="file"
                                multiple
                                onChange={(e) => {
                                    const selectedFiles = Array.from(e.target.files || [])
                                    setFiles(selectedFiles.slice(0, 3))
                                }}
                                hidden
                            />
                        </label>
                        {files.length > 0 && (
                            <div className="file-list">
                                {files.map((file, i) => (
                                    <div key={i} className="file-item">
                                        <div className="file-info">
                                            <Shield size={12} className="logo-icon" />
                                            <span>{file.name}</span>
                                        </div>
                                        {currentFileIndex === i && (
                                            <div className="progress-wrapper">
                                                <div className="progress-container">
                                                    <motion.div
                                                        className="progress-fill"
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                                <span className="progress-text">{Math.round(progress)}%</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
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
                        {password && mode === 'encrypt' && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="strength-meter"
                            >
                                <div className="strength-bar-bg">
                                    <motion.div
                                        className="strength-bar-fill"
                                        animate={{
                                            width: `${(passwordStrength.score / 5) * 100}%`,
                                            backgroundColor: passwordStrength.color
                                        }}
                                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                    />
                                </div>
                                <span className="strength-label" style={{ color: passwordStrength.color }}>
                                    Força: {passwordStrength.label}
                                </span>
                                {passwordStrength.score < 3 && (
                                    <span className="strength-hint">A senha deve ser pelo menos "Média"</span>
                                )}
                            </motion.div>
                        )}
                    </div>

                    {mode === 'encrypt' && (
                        <div className="input-group">
                            <button
                                className={`camouflage-toggle ${isCamouflageMode ? 'active' : ''}`}
                                onClick={() => setIsCamouflageMode(!isCamouflageMode)}
                            >
                                <div className="toggle-content">
                                    <Sparkles size={16} className={isCamouflageMode ? 'pulse' : ''} />
                                    <div className="text-left">
                                        <span className="toggle-title">Modo Camuflagem</span>
                                        <span className="toggle-hint">Esconder o vault dentro de uma imagem PNG</span>
                                    </div>
                                </div>
                                <div className="toggle-switch">
                                    <div className="switch-thumb"></div>
                                </div>
                            </button>
                        </div>
                    )}

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

                    {isDone ? (
                        <button
                            className="action-btn secondary"
                            onClick={resetVault}
                        >
                            Limpar e Novo Arquivo
                        </button>
                    ) : (
                        <button
                            className={`action-btn ${isProcessing ? 'loading' : ''}`}
                            disabled={files.length === 0 || !password || isProcessing}
                            onClick={handleAction}
                        >
                            {isProcessing ? 'Processando...' : (mode === 'encrypt' ? 'Proteger Arquivo' : 'Desbloquear Arquivo')}
                        </button>
                    )}
                </main>

                <footer className="footer-info">
                    <p>Tudo processado offline. Seus dados nunca saem do navegador.</p>
                </footer>
            </div>

            <div className="ad-container bottom-ad">
                <div className="ad-placeholder">Espaço para Anúncio (Banner Inferior)</div>
            </div>

            <div className="background-decor">
                <div className="circle-1"></div>
                <div className="circle-2"></div>
            </div>
        </div>
    )
}
