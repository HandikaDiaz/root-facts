import { useRef, useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import CameraSection from './components/CameraSection';
import InfoPanel from './components/InfoPanel';
import { useAppState } from './hooks/useAppState';
import { DetectionService } from './services/DetectionService';
import { CameraService } from './services/CameraService';
import { RootFactsService } from './services/RootFactsService';
import { APP_CONFIG, isValidDetection } from './utils/config';
import { createDelay, logError } from './utils/common';

function App() {
  const { state, actions } = useAppState();
  const detectionLoopRef = useRef(null);
  const isRunningRef = useRef(false);
  const lastDetectedRef = useRef(null);
  const [currentTone, setCurrentTone] = useState('normal');
  const [copyStatus, setCopyStatus] = useState('idle'); // 'idle' | 'copied'

  // TODO [Basic] Inisialisasi layanan deteksi, kamera, dan generator fakta saat aplikasi dimuat
  useEffect(() => {
    let cancelled = false;

    async function initServices() {
      const detector = new DetectionService();
      const camera = new CameraService();
      const generator = new RootFactsService();

      // Simpan ke state sebelum loading agar video ref bisa di-set
      actions.setServices({ detector, camera, generator });

      try {
        // Progress callback bersama — tampilkan status loading model
        const handleProgress = (message, _pct) => {
          if (!cancelled) {
            actions.setModelStatus(message);
          }
        };

        // Muat kedua model secara berurutan (detector dulu, lalu generator)
        actions.setModelStatus('Memuat Model AI... 0%');

        await detector.loadModel((msg, pct) => {
          if (!cancelled) actions.setModelStatus(`👁 ${msg} ${pct < 100 ? `(${pct}%)` : ''}`);
        });

        await generator.loadModel((msg, pct) => {
          if (!cancelled) actions.setModelStatus(`🧠 ${msg} ${pct < 100 ? `(${pct}%)` : ''}`);
        });

        if (!cancelled) {
          actions.setModelStatus('Model AI Siap');
          console.log('✅ Semua model berhasil dimuat');
        }
      } catch (error) {
        if (!cancelled) {
          logError('App.initServices', error);
          actions.setModelStatus('Gagal Memuat Model');
          actions.setError('Gagal memuat model AI. Coba refresh halaman.');
        }
      }
    }

    initServices();

    return () => {
      cancelled = true;
    };
  }, []);

  // TODO [Basic] Bersihkan sumber daya saat komponen ditinggalkan
  useEffect(() => {
    return () => {
      stopDetectionLoop();
      if (state.services.camera) {
        state.services.camera.stopCamera();
      }
    };
  }, [state.services.camera]);

  // TODO [Basic] Fungsi untuk memulai loop deteksi
  const startDetectionLoop = useCallback(() => {
    const { detector, camera, generator } = state.services;
    if (!detector || !camera || !generator) return;

    const fps = camera.fps || 30;
    const interval = 1000 / fps;
    let lastTime = 0;

    const loop = async (timestamp) => {
      if (!isRunningRef.current) return;

      const elapsed = timestamp - lastTime;

      if (elapsed >= interval) {
        lastTime = timestamp;

        if (camera.isReady() && detector.isLoaded()) {
          try {
            const result = await detector.predict(camera.video);

            if (result && isValidDetection(result)) {
              const isSameVegetable = lastDetectedRef.current === result.className;

              if (!isSameVegetable) {
                // Deteksi sayuran baru
                lastDetectedRef.current = result.className;

                actions.setDetectionResult({
                  className: result.className,
                  score: result.score,
                  confidence: result.confidence,
                });
                actions.setAppState('analyzing');
                actions.setFunFactData(null);

                // Delay sebelum generate fakta
                await createDelay(APP_CONFIG.analyzingDelay);

                if (!isRunningRef.current) return;

                actions.setAppState('result');

                // Generate fakta dengan Transformers.js
                try {
                  const fact = await generator.generateFacts(result.className);
                  if (isRunningRef.current) {
                    actions.setFunFactData(fact || 'Fakta tidak tersedia.');
                  }
                } catch {
                  if (isRunningRef.current) {
                    actions.setFunFactData('error');
                  }
                }
              }
            }
          } catch (error) {
            logError('DetectionLoop', error);
          }
        }
      }

      if (isRunningRef.current) {
        detectionLoopRef.current = requestAnimationFrame(loop);
      }
    };

    detectionLoopRef.current = requestAnimationFrame(loop);
  }, [state.services, actions]);

  const stopDetectionLoop = () => {
    isRunningRef.current = false;
    if (detectionLoopRef.current) {
      cancelAnimationFrame(detectionLoopRef.current);
      detectionLoopRef.current = null;
    }
    lastDetectedRef.current = null;
  };

  // TODO [Basic] Fungsi untuk memulai dan menghentikan kamera
  const handleToggleCamera = useCallback(async () => {
    const { camera } = state.services;
    if (!camera) return;

    if (state.isRunning) {
      // Hentikan kamera dan loop
      stopDetectionLoop();
      camera.stopCamera();
      actions.setRunning(false);
      actions.resetResults();
    } else {
      // Mulai kamera
      try {
        actions.setError(null);
        await camera.startCamera();
        actions.setRunning(true);
        isRunningRef.current = true;
        startDetectionLoop();
      } catch (error) {
        actions.setError(error.message);
        actions.setRunning(false);
      }
    }
  }, [state.services, state.isRunning, actions, startDetectionLoop]);

  // Restart detection loop ketika isRunning berubah jadi true dan services sudah siap
  useEffect(() => {
    if (state.isRunning && isRunningRef.current && state.services.detector) {
      // Loop sudah dimulai dari handleToggleCamera
    }
  }, [state.isRunning, state.services]);

  // TODO [Advance] Fungsi untuk mengubah nada fakta yang dihasilkan
  const handleToneChange = useCallback((tone) => {
    setCurrentTone(tone);
    if (state.services.generator) {
      state.services.generator.setTone(tone);
    }
  }, [state.services.generator]);

  // TODO [Skilled] Fungsi untuk menyalin fakta ke clipboard
  const handleCopyFact = useCallback(async () => {
    if (!state.funFactData || state.funFactData === 'error') return;

    try {
      const textToCopy = `${state.detectionResult?.className}: ${state.funFactData}`;
      await navigator.clipboard.writeText(textToCopy);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) {
      logError('handleCopyFact', error);
      actions.setError('Gagal menyalin ke clipboard.');
    }
  }, [state.funFactData, state.detectionResult, actions]);

  return (
    <div className="app-container">
      <Header modelStatus={state.modelStatus} />

      <main className="main-content">
        <CameraSection
          isRunning={state.isRunning}
          onToggleCamera={handleToggleCamera}
          onToneChange={handleToneChange}
          services={state.services}
          modelStatus={state.modelStatus}
          error={state.error}
          currentTone={currentTone}
        />

        <InfoPanel
          appState={state.appState}
          detectionResult={state.detectionResult}
          funFactData={state.funFactData}
          error={state.error}
          onCopyFact={handleCopyFact}
          copyStatus={copyStatus}
        />
      </main>

      <footer className="footer">
        <p>Powered by TensorFlow.js &amp; Transformers.js</p>
      </footer>

      {state.error && (
        <div style={{
          position: 'fixed',
          bottom: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: '380px',
          padding: '0.875rem 1rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          color: '#991b1b',
          fontSize: '0.8125rem',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          zIndex: 1000
        }}>
          <strong>Error:</strong> {state.error}
          <button
            onClick={() => actions.setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: '#991b1b',
              padding: 0,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
