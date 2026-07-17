import { pipeline } from '@huggingface/transformers';
import { TONE_CONFIG } from '../utils/config.js';
import { isWebGPUSupported, logError } from '../utils/common.js';

// Konfigurasi prompt berdasarkan tone/persona
const TONE_PROMPTS = {
  normal: (veg) =>
    `Give one fun and interesting fact about ${veg} as a vegetable. Keep it informative and short.`,
  funny: (veg) =>
    `Tell a funny and humorous fact about ${veg} as a vegetable. Make it entertaining and silly.`,
  professional: (veg) =>
    `Provide a scientific and nutritional fact about ${veg}. Use formal academic language.`,
  casual: (veg) =>
    `Share a cool and surprising fact about ${veg} in a friendly, casual way like talking to a friend.`,
};

export class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.config = null;
    this.currentBackend = null;
    this.currentTone = TONE_CONFIG.defaultTone;
  }

  // [Basic] Muat model dan inisialisasi pipeline text2text-generation
  // [Advance] Implementasikan strategi Backend Adaptive
  async loadModel(onProgress) {
    try {
      if (onProgress) onProgress('Memuat model bahasa...', 10);

      // Backend Adaptive: WebGPU → CPU
      let device = 'cpu';
      if (isWebGPUSupported()) {
        try {
          device = 'webgpu';
          console.log('✅ Transformers.js menggunakan WebGPU');
        } catch {
          device = 'cpu';
          console.warn('⚠️ WebGPU tidak tersedia untuk Transformers.js, menggunakan CPU');
        }
      }

      this.currentBackend = device;

      // Inisialisasi pipeline text-generation dengan model kecil
      this.generator = await pipeline(
        'text2text-generation',
        'Xenova/flan-t5-small',
        {
          dtype: 'q4',
          device,
          progress_callback: (progress) => {
            if (onProgress && progress.progress !== undefined) {
              const pct = Math.round(progress.progress);
              onProgress(`Memuat model AI... ${pct}%`, pct);
            }
          },
        }
      );

      this.isModelLoaded = true;
      if (onProgress) onProgress('Model AI Siap', 100);
      console.log(`✅ Transformers.js pipeline siap (backend: ${device})`);

      return true;
    } catch (error) {
      logError('RootFactsService.loadModel', error);
      throw error;
    }
  }

  // [Advance] Konfigurasi tone fakta yang dihasilkan
  setTone(tone) {
    if (TONE_CONFIG.availableTones.some((t) => t.value === tone)) {
      this.currentTone = tone;
      console.log(`✅ Tone diubah ke: ${tone}`);
    }
  }

  // [Basic] Lakukan generasi fakta dan kembalikan hasilnya
  // [Skilled] Konfigurasikan parameter generasi berdasarkan kebutuhan
  // [Advance] Implementasikan parameter tone untuk mengatur nada fakta
  async generateFacts(vegetableName) {
    if (!this.isReady()) {
      throw new Error('Model belum dimuat');
    }

    if (this.isGenerating) {
      return null; // Hindari request ganda
    }

    this.isGenerating = true;

    try {
      // Buat prompt berdasarkan tone saat ini
      const promptFn = TONE_PROMPTS[this.currentTone] || TONE_PROMPTS.normal;
      const prompt = promptFn(vegetableName);

      console.log(`🧠 Generating fact for: ${vegetableName} (tone: ${this.currentTone})`);

      const results = await this.generator(prompt, {
        max_new_tokens: 120,       // [Skilled] max_new_tokens ≤ 150
        temperature: 0.85,          // [Skilled] temperature untuk kreativitas
        top_p: 0.92,               // [Skilled] top_p nucleus sampling
        do_sample: true,           // [Skilled] aktifkan sampling
        repetition_penalty: 1.3,   // Kurangi pengulangan kata
      });

      if (results && results.length > 0) {
        const text = results[0].generated_text || results[0].translation_text || '';
        return text.trim() || null;
      }

      return null;
    } catch (error) {
      logError('RootFactsService.generateFacts', error);
      throw error;
    } finally {
      this.isGenerating = false;
    }
  }

  // [Basic] Periksa apakah model sudah dimuat dan siap digunakan
  isReady() {
    return this.isModelLoaded && this.generator !== null;
  }
}
