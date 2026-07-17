import * as tf from '@tensorflow/tfjs';
import { isWebGPUSupported, logError, validateModelMetadata } from '../utils/common.js';

export class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
    this.config = null;
    this.currentBackend = null;
    this.imageSize = 224;
  }

  // [Basic] Muat model dan metadata secara bersamaan, lalu simpan ke instance
  // [Advance] Implementasikan strategi Backend Adaptive
  async loadModel(onProgress) {
    try {
      // Backend Adaptive: WebGPU → WebGL
      if (isWebGPUSupported()) {
        try {
          await import('@tensorflow/tfjs-backend-webgpu');
          await tf.setBackend('webgpu');
          await tf.ready();
          this.currentBackend = 'webgpu';
          console.log('✅ Menggunakan backend: WebGPU');
        } catch {
          console.warn('⚠️ WebGPU tidak tersedia, fallback ke WebGL');
          await tf.setBackend('webgl');
          await tf.ready();
          this.currentBackend = 'webgl';
        }
      } else {
        await tf.setBackend('webgl');
        await tf.ready();
        this.currentBackend = 'webgl';
        console.log('✅ Menggunakan backend: WebGL');
      }

      if (onProgress) onProgress('Memuat metadata...', 10);

      // Muat metadata dan model secara bersamaan
      const [metadataRes] = await Promise.all([
        fetch('/model/metadata.json'),
      ]);

      if (!metadataRes.ok) {
        throw new Error('Gagal memuat metadata model');
      }

      const metadata = await metadataRes.json();

      if (!validateModelMetadata(metadata)) {
        throw new Error('Metadata model tidak valid');
      }

      this.labels = metadata.labels;
      this.imageSize = metadata.imageSize || 224;

      if (onProgress) onProgress('Memuat bobot model...', 40);

      // Muat model TF.js
      this.model = await tf.loadLayersModel('/model/model.json', {
        onProgress: (fraction) => {
          if (onProgress) {
            const pct = Math.round(40 + fraction * 55);
            onProgress(`Memuat model... ${pct}%`, pct);
          }
        },
      });

      if (onProgress) onProgress('Model AI Siap', 100);
      console.log(`✅ Model berhasil dimuat (${this.labels.length} label, backend: ${this.currentBackend})`);

      return true;
    } catch (error) {
      logError('DetectionService.loadModel', error);
      throw error;
    }
  }

  // [Basic] Lakukan prediksi pada elemen gambar yang diberikan dan kembalikan hasilnya
  async predict(imageElement) {
    if (!this.isLoaded()) return null;

    return tf.tidy(() => {
      try {
        // Preprocessing: resize & normalize
        const tensor = tf.browser
          .fromPixels(imageElement)
          .resizeBilinear([this.imageSize, this.imageSize])
          .toFloat()
          .div(tf.scalar(255))
          .expandDims(0);

        const predictions = this.model.predict(tensor);
        const probabilities = predictions.dataSync();

        // Temukan prediksi dengan confidence tertinggi
        let maxIndex = 0;
        let maxScore = 0;

        for (let i = 0; i < probabilities.length; i++) {
          if (probabilities[i] > maxScore) {
            maxScore = probabilities[i];
            maxIndex = i;
          }
        }

        const confidencePercent = Math.round(maxScore * 100);

        return {
          className: this.labels[maxIndex] || 'Unknown',
          score: maxScore,
          confidence: confidencePercent,
          isValid: confidencePercent >= 0, // threshold divalidasi di config.js
        };
      } catch (error) {
        logError('DetectionService.predict', error);
        return null;
      }
    });
  }

  // [Basic] Periksa apakah model sudah dimuat dan siap digunakan
  isLoaded() {
    return this.model !== null;
  }
}
