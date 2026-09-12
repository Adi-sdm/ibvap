import React, { useState } from 'react';
import { 
  X, Check, AlertTriangle, Upload, Eye, Shield, User, Camera, 
  ArrowRight, ArrowLeft, RefreshCw, Lock, Sparkles, CheckCircle2,
  FileBadge, HelpCircle
} from 'lucide-react';
import { validateFRSPhoto, enrollFRSPerson } from '../services/api';

const RANKS = [
  'Captain', 'Major', 'Colonel', 'Lieutenant', 'Sub-Inspector', 
  'Inspector', 'Havildar', 'Constable', 'Security Officer', 'Civilian Specialist', 'Contractor'
];

const CATEGORIES = [
  { id: 'OPERATIONAL', label: 'Operational Personnel', color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' },
  { id: 'SECURITY', label: 'Perimeter Security', color: 'border-sky-500/40 text-sky-400 bg-sky-500/10' },
  { id: 'VISITOR', label: 'Authorized Visitor', color: 'border-blue-500/40 text-blue-400 bg-blue-500/10' },
  { id: 'VIP', label: 'VIP / Dignitary', color: 'border-purple-500/40 text-purple-400 bg-purple-500/10' },
  { id: 'WATCHLIST', label: 'Watchlist / Threat Flagged', color: 'border-rose-500/40 text-rose-400 bg-rose-500/10' }
];

export default function FaceEnrollmentModal({ isOpen, onClose, onEnrolled, systemMode = 'live' }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    rank: 'Inspector',
    designation: 'Perimeter Security Lead',
    organization: 'Border Security Force',
    category: 'OPERATIONAL',
    status: 'ACTIVE',
    notes: '',
    operator: 'Chief Surveillance Officer'
  });

  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [validations, setValidations] = useState([]);
  const [validating, setValidating] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollResult, setEnrollResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!isOpen) return null;

  const handleFileChange = async (e) => {
    const selected = Array.from(e.target.files);
    if (!selected.length) return;

    setErrorMsg(null);
    const newFiles = [...files, ...selected].slice(0, 5);
    setFiles(newFiles);

    // Generate previews
    const newPreviews = newFiles.map(f => URL.createObjectURL(f));
    setPreviews(newPreviews);

    // Validate images
    setValidating(true);
    const results = [];
    for (const f of newFiles) {
      try {
        const val = await validateFRSPhoto(f);
        results.push(val);
      } catch (err) {
        results.push({
          passed: false,
          score: 0,
          reasons: ['Validation service connection error']
        });
      }
    }
    setValidations(results);
    setValidating(false);
  };

  const removeFile = (idx) => {
    const nextFiles = files.filter((_, i) => i !== idx);
    const nextPreviews = previews.filter((_, i) => i !== idx);
    const nextVals = validations.filter((_, i) => i !== idx);
    setFiles(nextFiles);
    setPreviews(nextPreviews);
    setValidations(nextVals);
  };

  const handleNext = () => {
    setErrorMsg(null);
    if (step === 1) {
      if (!formData.name.trim()) {
        setErrorMsg('Personnel full name is required.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (files.length < 1) {
        setErrorMsg('Please upload at least 1 image (3 recommended).');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      const hasPassed = validations.some(v => v.passed || v.score >= 30);
      if (!hasPassed) {
        setErrorMsg('At least one uploaded photo must meet facial detection standards.');
        return;
      }
      setStep(4);
    } else if (step === 4) {
      setStep(5);
    } else if (step === 5) {
      handleFinalEnroll();
    }
  };

  const handleFinalEnroll = async () => {
    setEnrolling(true);
    setErrorMsg(null);
    try {
      const fd = new FormData();
      fd.append('name', formData.name);
      fd.append('rank', formData.rank);
      fd.append('designation', formData.designation);
      fd.append('organization', formData.organization);
      fd.append('category', formData.category);
      fd.append('status', formData.status);
      fd.append('notes', formData.notes);
      fd.append('operator', formData.operator);
      fd.append('is_demo', systemMode === 'demo');

      files.forEach((f) => {
        fd.append('images', f);
      });

      const res = await enrollFRSPerson(fd);
      setEnrollResult(res);
      setStep(6);
      if (onEnrolled) onEnrolled(res);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to complete enrollment.');
    } finally {
      setEnrolling(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setFormData({
      name: '',
      rank: 'Inspector',
      designation: 'Perimeter Security Lead',
      organization: 'Border Security Force',
      category: 'OPERATIONAL',
      status: 'ACTIVE',
      notes: '',
      operator: 'Chief Surveillance Officer'
    });
    setFiles([]);
    setPreviews([]);
    setValidations([]);
    setEnrollResult(null);
    setErrorMsg(null);
    onClose();
  };

  const avgQuality = validations.length
    ? Math.round(validations.reduce((acc, v) => acc + (v.score || 0), 0) / validations.length)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide uppercase font-mono">
                  Biometric Face Enrollment
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  FERNET ENCRYPTED
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                SIH26187 // Defense-Grade Biometric Registry Wizard
              </p>
            </div>
          </div>
          <button 
            onClick={handleReset}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs font-mono">
          {[
            { num: 1, label: 'Identity' },
            { num: 2, label: 'Photos' },
            { num: 3, label: 'Quality' },
            { num: 4, label: 'Embedding' },
            { num: 5, label: 'Preview' },
            { num: 6, label: 'Saved' }
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${
                step === s.num 
                  ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-400/40' 
                  : step > s.num 
                    ? 'bg-emerald-950 border border-emerald-500/50 text-emerald-400' 
                    : 'bg-slate-800 text-slate-500'
              }`}>
                {step > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
              </div>
              <span className={step === s.num ? 'text-emerald-400 font-bold hidden sm:inline' : 'text-slate-500 hidden sm:inline'}>
                {s.label}
              </span>
              {s.num < 6 && <div className="w-4 h-px bg-slate-800 hidden sm:block" />}
            </div>
          ))}
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Body Content by Step */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* STEP 1: IDENTITY PROFILE */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400 font-mono">
                STEP 1 OF 6 // ENTER SERVICE IDENTITY RECORD
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Full Official Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Captain Vikram Rathore"
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Rank / Designation</label>
                  <select
                    value={formData.rank}
                    onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Operational Role</label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g. Perimeter Guard / QRT Lead"
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Security / Defense Unit</label>
                  <input
                    type="text"
                    value={formData.organization}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    placeholder="e.g. Border Security Force"
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-2">Category Classification</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, category: cat.id })}
                      className={`p-2.5 rounded-xl border text-left text-xs font-mono transition flex flex-col gap-1 ${
                        formData.category === cat.id
                          ? `${cat.color} ring-1 ring-white/20`
                          : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="font-bold">{cat.id}</span>
                      <span className="text-[10px] opacity-80">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Operational Clearance / Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Perimeter Zone Alpha 24/7 access authorized. Sector Patrol Unit."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* STEP 2: UPLOAD MULTI-ANGLE PHOTOS */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400 font-mono">
                  STEP 2 OF 6 // INGEST MULTI-ANGLE BIOMETRIC SAMPLES
                </div>
                <span className="text-xs font-mono text-emerald-400">
                  {files.length} / 5 Images Uploaded
                </span>
              </div>

              <div className="p-6 rounded-2xl border-2 border-dashed border-slate-700 hover:border-emerald-500/50 bg-slate-950/40 text-center transition cursor-pointer relative group">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-3 group-hover:scale-110 transition">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-sm font-bold text-white">Click or drag & drop facial photos</div>
                <p className="text-xs text-slate-400 mt-1">
                  Upload 3 to 5 images: Frontal, Left 30°, Right 30°, Slight Upward, Neutral
                </p>
                <div className="mt-3 inline-flex items-center gap-2 text-[11px] font-mono text-slate-500 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  Images encrypted at rest via Fernet secrets vault
                </div>
              </div>

              {/* Photo Thumbnails */}
              {previews.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {previews.map((url, i) => (
                    <div key={i} className="relative group rounded-xl overflow-hidden border border-slate-700 aspect-square bg-slate-950">
                      <img src={url} alt="Crop" className="w-full h-full object-cover" />
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-slate-900/80 text-[10px] font-mono text-white">
                        #{i + 1}
                      </div>
                      <button
                        onClick={() => removeFile(i)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-rose-950/80 text-rose-300 hover:bg-rose-900 opacity-0 group-hover:opacity-100 transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: FACE QUALITY VALIDATION */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400 font-mono">
                  STEP 3 OF 6 // BIOMETRIC QUALITY VALIDATION
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono">Mean Quality Score:</span>
                  <span className={`font-mono text-sm font-bold ${avgQuality >= 60 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {avgQuality}%
                  </span>
                </div>
              </div>

              {validating ? (
                <div className="p-8 text-center space-y-3 bg-slate-950/50 rounded-2xl border border-slate-800">
                  <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
                  <div className="text-sm font-mono text-slate-300">Auditing resolution, sharpness, and illumination...</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {validations.map((val, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={previews[idx]} 
                          alt="Face preview" 
                          className="w-12 h-12 rounded-lg object-cover border border-slate-600 shrink-0" 
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-white">Sample #{idx + 1}</span>
                            {val.passed ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                PASSED
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                FLAGGED
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                            Sharpness: {val.sharpness || 0} | Contrast: {val.brightness || 0} | Res: {val.resolution || 'N/A'}
                          </div>
                          {val.reasons && val.reasons.length > 0 && (
                            <div className="text-[10px] text-amber-400 mt-1">
                              Notice: {val.reasons.join(', ')}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="w-24 text-right shrink-0">
                        <div className="text-xs font-mono font-bold text-white">{val.score || 0}%</div>
                        <div className="w-full bg-slate-700 h-1.5 rounded-full mt-1 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              val.score >= 60 ? 'bg-emerald-500' : (val.score >= 30 ? 'bg-amber-500' : 'bg-rose-500')
                            }`}
                            style={{ width: `${Math.min(100, val.score || 0)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: EMBEDDING GENERATION */}
          {step === 4 && (
            <div className="space-y-4 text-center py-6">
              <div className="text-xs text-slate-400 font-mono">
                STEP 4 OF 6 // 128-DIMENSIONAL FEATURE VECTOR EXTRACTION
              </div>

              <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                <Sparkles className="w-10 h-10 animate-pulse" />
              </div>

              <div>
                <h4 className="text-base font-bold text-white tracking-wide">
                  YuNet 5-Point Alignment & SFace Embedding
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-2">
                  Facial features are aligned with affine transformation, normalized to unit L2 sphere, 
                  and encrypted using the system-bound Fernet key before persisting.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto text-left font-mono text-xs">
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700">
                  <div className="text-slate-400 text-[10px]">VECTOR SPACE</div>
                  <div className="text-white font-bold mt-1">128-D Float32</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700">
                  <div className="text-slate-400 text-[10px]">ALIGNMENT</div>
                  <div className="text-white font-bold mt-1">5 Keypoints</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700">
                  <div className="text-slate-400 text-[10px]">STORAGE</div>
                  <div className="text-emerald-400 font-bold mt-1">Encrypted Blob</div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: VERIFICATION PREVIEW */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400 font-mono">
                STEP 5 OF 6 // VERIFY PERSONNEL DOSSIER SUMMARY
              </div>

              <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                {previews[0] ? (
                  <img 
                    src={previews[0]} 
                    alt="Primary" 
                    className="w-24 h-24 rounded-2xl object-cover border-2 border-emerald-500/50 shadow-lg shrink-0" 
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                    <User className="w-10 h-10" />
                  </div>
                )}

                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-800 border border-slate-700 text-slate-300">
                      {formData.rank}
                    </span>
                    <h4 className="text-lg font-bold text-white tracking-wide">{formData.name}</h4>
                  </div>
                  
                  <div className="text-xs font-mono text-slate-400">
                    {formData.designation} // {formData.organization}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                      {formData.category}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
                      Quality: {avgQuality}%
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
                      Samples: {files.length} Angles
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-mono text-slate-400 space-y-1">
                <div className="text-slate-300 font-bold">OPERATIONAL DIRECTIVE:</div>
                <div>+ Biometric vectors will be encrypted and committed to SQLite gallery.</div>
                <div>+ Immutable audit record created under operator: <span className="text-emerald-400">{formData.operator}</span>.</div>
                <div>+ Active live cameras will immediately begin track-associated recognition matching.</div>
              </div>
            </div>
          )}

          {/* STEP 6: ENROLLMENT CONFIRMATION */}
          {step === 6 && enrollResult && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white tracking-wide">Personnel Successfully Enrolled</h3>
                <p className="text-xs text-slate-400 font-mono mt-1">
                  Assigned Biometric Identifier: <span className="text-emerald-400 font-bold">{enrollResult.person_id}</span>
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 max-w-md mx-auto text-left font-mono text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Personnel Name:</span>
                  <span className="text-white font-bold">{enrollResult.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Reference Images:</span>
                  <span className="text-white">{enrollResult.enrolled_images} photos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Biometric Quality:</span>
                  <span className="text-emerald-400 font-bold">{enrollResult.quality_score}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Encryption Status:</span>
                  <span className="text-emerald-400 font-bold">SEALED AT REST</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
          {step < 6 ? (
            <>
              <button
                type="button"
                disabled={step === 1}
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-mono text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition flex items-center gap-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Previous
              </button>

              <button
                type="button"
                disabled={validating || enrolling}
                onClick={handleNext}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs tracking-wide transition shadow-lg shadow-emerald-500/20 flex items-center gap-2"
              >
                {enrolling ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Committing Biometrics...
                  </>
                ) : step === 5 ? (
                  <>
                    <Shield className="w-3.5 h-3.5" />
                    Commit & Encrypt
                  </>
                ) : (
                  <>
                    Next Step
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleReset}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs tracking-wide transition"
            >
              Return to Recognition Center
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
