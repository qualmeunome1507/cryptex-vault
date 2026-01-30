import { useState, useEffect } from 'react'
import { Shield, Unlock, Lock, FileUp, Download, Eye, EyeOff, AlertCircle, CheckCircle2, Image as ImageIcon, Sparkles, FileText, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { encryptFile, decryptFile, wrapInImage, unwrapFromImage } from './crypto'
import { LEGAL_CONTENT } from './LegalContent'
import { translations, Language } from './i18n'
import { Languages } from 'lucide-react'

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
    const [showLegal, setShowLegal] = useState(false)
    const [lang, setLang] = useState<Language>(() => {
        const saved = localStorage.getItem('cryptex-lang') as Language
        return saved || (navigator.language.startsWith('pt') ? 'pt' : navigator.language.startsWith('es') ? 'es' : 'en')
    })

    const t = (key: keyof typeof translations['pt']) => translations[lang][key]

    useEffect(() => {
        localStorage.setItem('cryptex-lang', lang)
    }, [lang])

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
                <div className="ad-placeholder">{t('ad_top')}</div>
            </div>

            <div className="glass-panel main-vault">
                <header className="header">
                    <div className="header-top">
                        <div className="language-switcher">
                            <button onClick={() => setLang('pt')} className={lang === 'pt' ? 'active' : ''}>PT</button>
                            <button onClick={() => setLang('en')} className={lang === 'en' ? 'active' : ''}>EN</button>
                            <button onClick={() => setLang('es')} className={lang === 'es' ? 'active' : ''}>ES</button>
                        </div>
                    </div>
                    <div className="logo">
                        <Shield className="logo-icon" />
                        <h1>{t('title')}</h1>
                    </div>
                    <p className="subtitle">{t('subtitle')}</p>
                </header>

                <div className="mode-selector">
                    <button
                        className={mode === 'encrypt' ? 'active' : ''}
                        onClick={() => setMode('encrypt')}
                    >
                        <Lock size={18} /> {t('encrypt')}
                    </button>
                    <button
                        className={mode === 'decrypt' ? 'active' : ''}
                        onClick={() => setMode('decrypt')}
                    >
                        <Unlock size={18} /> {t('decrypt')}
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
                            <span>{files.length > 0 ? `${files.length} arquivo(s) selecionado(s)` : t('select_files')}</span>
                            <span className="limit-notice">{t('max_files')}</span>
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
                                placeholder={t('password_placeholder')}
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
                                    Força: {t(passwordStrength.label.toLowerCase().includes('fraca') ? 'strength_weak' : passwordStrength.label.toLowerCase().includes('média') ? 'strength_medium' : 'strength_strong' as any)}
                                </span>
                                {passwordStrength.score < 3 && (
                                    <span className="strength-hint">{t('strength_hint')}</span>
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
                                        <span className="toggle-title">{t('camouflage_mode')}</span>
                                        <span className="toggle-hint">{t('camouflage_desc')}</span>
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
                            {t('clear_new')}
                        </button>
                    ) : (
                        <button
                            className={`action-btn ${isProcessing ? 'loading' : ''}`}
                            disabled={files.length === 0 || !password || isProcessing}
                            onClick={handleAction}
                        >
                            {isProcessing ? t('processing') : (mode === 'encrypt' ? t('action_encrypt') : t('action_decrypt'))}
                        </button>
                    )}
                </main>

                <footer className="footer-info">
                    <p>{t('offline_notice')}</p>
                    <div className="footer-links-legal">
                        <button onClick={() => setShowLegal(true)} className="legal-btn">
                            <FileText size={14} />
                            {t('legal_links')}
                        </button>
                    </div>
                </footer>
            </div>

            <section className="seo-content-section">
                <div className="seo-grid">
                    <div className="seo-card">
                        <Shield className="seo-icon" />
                        <h3>{t('seo_card_aes_title')}</h3>
                        <p>{t('seo_card_aes_desc')}</p>
                    </div>
                    <div className="seo-card">
                        <Unlock className="seo-icon" />
                        <h3>{t('seo_card_privacy_title')}</h3>
                        <p>{t('seo_card_privacy_desc')}</p>
                    </div>
                    <div className="seo-card">
                        <ImageIcon className="seo-icon" />
                        <h3>{t('seo_card_camouflage_title')}</h3>
                        <p>{t('seo_card_camouflage_desc')}</p>
                    </div>
                    <div className="seo-card">
                        <Sparkles className="seo-icon" />
                        <h3>{t('seo_card_performance_title')}</h3>
                        <p>{t('seo_card_performance_desc')}</p>
                    </div>
                </div>
                <div className="seo-footer-text">
                    <h2>{t('seo_footer_title')}</h2>
                    <p>{t('seo_footer_desc')}</p>
                </div>
            </section>

            <AnimatePresence>
                {showLegal && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowLegal(false)}
                    >
                        <motion.div
                            className="modal-content glass-panel"
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <div className="modal-title">
                                    <FileText className="primary-icon" />
                                    <h2>{t('legal_title')}</h2>
                                </div>
                                <button className="close-btn" onClick={() => setShowLegal(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="modal-body">
                                <div className="policy-text">
                                    {LEGAL_CONTENT[lang]}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="ad-container bottom-ad">
                <div className="ad-placeholder">{t('ad_bottom')}</div>
            </div>

            <div className="background-decor">
                <div className="circle-1"></div>
                <div className="circle-2"></div>
            </div>
        </div>
    )
}
