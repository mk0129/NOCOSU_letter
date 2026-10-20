export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start(): Promise<void> {
    this.audioChunks = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('お使いのブラウザはマイク録音に対応していません。');
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Determine supported mimeType
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      let selectedMimeType = '';
      for (const mt of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mt)) {
          selectedMimeType = mt;
          break;
        }
      }

      this.mediaRecorder = selectedMimeType
        ? new MediaRecorder(this.stream, { mimeType: selectedMimeType })
        : new MediaRecorder(this.stream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(250); // Slice every 250ms
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        throw new Error('マイクへのアクセスが許可されていません。ブラウザの設定でマイクを許可してください。');
      }
      throw new Error('マイクの起動に失敗しました。');
    }
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('録音が開始されていません。'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });

        // Clean up tracks
        if (this.stream) {
          this.stream.getTracks().forEach((track) => track.stop());
          this.stream = null;
        }
        this.mediaRecorder = null;
        this.audioChunks = [];

        resolve(audioBlob);
      };

      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  cancel(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}
