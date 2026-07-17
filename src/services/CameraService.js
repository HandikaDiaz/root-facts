import { getCameraErrorMessage, logError } from '../utils/common.js';

export class CameraService {
  constructor() {
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.config = null;
    this.fps = 30;
    this.cameras = [];
  }

  setVideoElement(videoElement) {
    this.video = videoElement;
  }

  setCanvasElement(canvasElement) {
    this.canvas = canvasElement;
  }

  // [Basic] Tambahkan konfigurasi kamera untuk mendapatkan daftar perangkat input video
  // [Basic] Dapatkan constraints kamera berdasarkan konfigurasi dan kamera yang dipilih
  async loadCameras() {
    try {
      // Minta izin kamera terlebih dahulu agar label perangkat tersedia
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach((t) => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      this.cameras = devices.filter((d) => d.kind === 'videoinput');

      console.log(`✅ Ditemukan ${this.cameras.length} kamera`);
      return this.cameras;
    } catch (error) {
      logError('CameraService.loadCameras', error);
      return [];
    }
  }

  // Dapatkan constraints berdasarkan konfigurasi
  _getConstraints(selectedCameraId) {
    const frameRate = { ideal: this.fps, max: this.fps };

    if (selectedCameraId && selectedCameraId !== 'default') {
      // Kamera spesifik berdasarkan ID
      if (selectedCameraId === 'front') {
        return { video: { facingMode: 'user', frameRate }, audio: false };
      }
      if (selectedCameraId === 'back') {
        return { video: { facingMode: { ideal: 'environment' }, frameRate }, audio: false };
      }
      return { video: { deviceId: { exact: selectedCameraId }, frameRate }, audio: false };
    }

    // Default: kamera belakang
    return { video: { facingMode: { ideal: 'environment' }, frameRate }, audio: false };
  }

  // [Basic] Memulai kamera dengan perangkat yang dipilih dan menampilkan pada elemen video
  async startCamera(selectedCameraId = 'default') {
    try {
      // Hentikan stream sebelumnya jika ada
      this.stopCamera();

      const constraints = this._getConstraints(selectedCameraId);
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (!this.video) {
        throw new Error('Elemen video tidak ditemukan');
      }

      this.video.srcObject = this.stream;

      // Tunggu sampai video siap
      await new Promise((resolve, reject) => {
        this.video.onloadedmetadata = resolve;
        this.video.onerror = reject;
        setTimeout(reject, 10000); // timeout 10 detik
      });

      await this.video.play();
      console.log('✅ Kamera berhasil dimulai');
      return true;
    } catch (error) {
      const message = getCameraErrorMessage(error);
      logError('CameraService.startCamera', error);
      throw new Error(message);
    }
  }

  // [Basic] Menghentikan siaran kamera dan membersihkan sumber daya
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
    console.log('✅ Kamera dihentikan');
  }

  // [Skilled] Implementasikan metode untuk mengatur FPS kamera
  setFPS(fps) {
    this.fps = fps;
  }

  // [Basic] Periksa apakah kamera sedang aktif
  isActive() {
    return !!(this.stream && this.stream.active);
  }

  // [Basic] Periksa apakah elemen video siap untuk digunakan
  isReady() {
    return !!(this.video && this.video.readyState >= 2 && this.video.videoWidth > 0);
  }
}