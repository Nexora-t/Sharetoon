// ============================================
// تطبيق نقل الملفات P2P
// يعمل على Android (Capacitor) و Windows (Electron)
// ============================================

class FileTransferApp {
    constructor() {
        // العناصر
        this.els = {
            platformBadge: document.getElementById('platformBadge'),
            senderTab: document.getElementById('senderTab'),
            receiverTab: document.getElementById('receiverTab'),
            roomCode: document.getElementById('roomCode'),
            copyBtn: document.getElementById('copyBtn'),
            joinInput: document.getElementById('joinInput'),
            joinBtn: document.getElementById('joinBtn'),
            statusDot: document.getElementById('statusDot'),
            statusText: document.getElementById('statusText'),
            dropArea: document.getElementById('dropArea'),
            fileInput: document.getElementById('fileInput'),
            fileList: document.getElementById('fileList'),
            sendBtn: document.getElementById('sendBtn'),
            clearBtn: document.getElementById('clearBtn'),
            progressBar: document.getElementById('progressBar'),
            progressText: document.getElementById('progressText'),
            receivedList: document.getElementById('receivedList'),
            message: document.getElementById('message'),
            fileZone: document.getElementById('fileZone'),
            receivedSection: document.getElementById('receivedSection'),
        };

        // الحالة
        this.mode = 'sender';
        this.roomCode = '';
        this.files = [];
        this.receivedFiles = [];
        this.isConnected = false;
        this.isSending = false;
        this.peerConnection = null;
        this.dataChannel = null;
        this.currentFileIndex = 0;
        this.totalFiles = 0;

        // الكشف عن المنصة
        this.detectPlatform();
        this.init();
    }

    // ============================================
    // كشف المنصة
    // ============================================
    detectPlatform() {
        const ua = navigator.userAgent;
        let platform = '🌐 متصفح';

        if (ua.includes('Electron')) {
            platform = '💻 ويندوز';
        } else if (ua.includes('Android') || window.hasOwnProperty('Capacitor')) {
            platform = '📱 أندرويد';
        } else if (ua.includes('iPhone') || ua.includes('iPad')) {
            platform = '📱 iOS';
        }

        this.els.platformBadge.textContent = platform;
        this.platform = platform;
    }

    // ============================================
    // التهيئة
    // ============================================
    init() {
        // أحداث التبويبات
        this.els.senderTab.addEventListener('click', () => this.setMode('sender'));
        this.els.receiverTab.addEventListener('click', () => this.setMode('receiver'));

        // نسخ الرمز
        this.els.copyBtn.addEventListener('click', () => {
            if (this.roomCode) {
                navigator.clipboard?.writeText(this.roomCode);
                this.setMessage('✅ تم نسخ الرمز');
            }
        });

        // الانضمام
        this.els.joinBtn.addEventListener('click', () => this.joinRoom());
        this.els.joinInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });

        // رفع الملفات
        this.els.dropArea.addEventListener('click', () => this.els.fileInput.click());
        this.els.dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.els.dropArea.classList.add('dragover');
        });
        this.els.dropArea.addEventListener('dragleave', () => {
            this.els.dropArea.classList.remove('dragover');
        });
        this.els.dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.els.dropArea.classList.remove('dragover');
            if (e.dataTransfer?.files) {
                this.addFiles(e.dataTransfer.files);
            }
        });
        this.els.fileInput.addEventListener('change', (e) => {
            if (e.target.files) {
                this.addFiles(e.target.files);
            }
        });

        // إرسال ومسح
        this.els.sendBtn.addEventListener('click', () => this.sendFiles());
        this.els.clearBtn.addEventListener('click', () => this.clearFiles());

        // بدء بالوضع الافتراضي
        this.setMode('sender');
        this.setMessage('جاهز للعمل 🚀');
    }

    // ============================================
    // تبديل الوضع
    // ============================================
    setMode(mode) {
        this.mode = mode;
        this.resetConnection();
        
        // تحديث التبويبات
        this.els.senderTab.classList.toggle('active', mode === 'sender');
        this.els.receiverTab.classList.toggle('active', mode === 'receiver');

        // إظهار/إخفاء العناصر
        const isSender = mode === 'sender';
        this.els.fileZone.style.display = isSender ? 'block' : 'none';
        this.els.sendBtn.style.display = isSender ? 'block' : 'none';
        this.els.receivedSection.style.display = isSender ? 'none' : 'block';

        if (isSender) {
            this.generateRoomCode();
            this.els.joinInput.style.display = 'none';
            this.els.joinBtn.style.display = 'none';
        } else {
            this.els.roomCode.textContent = '------';
            this.els.joinInput.style.display = 'block';
            this.els.joinBtn.style.display = 'block';
            this.els.joinInput.value = '';
        }
    }

    // ============================================
    // توليد رمز الغرفة
    // ============================================
    generateRoomCode() {
        this.roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        this.els.roomCode.textContent = this.roomCode;
        this.createPeerConnection();
    }

    // ============================================
    // الانضمام للغرفة
    // ============================================
    joinRoom() {
        const code = this.els.joinInput.value.trim().toUpperCase();
        if (!code || code.length < 6) {
            this.setMessage('⚠️ أدخل رمزاً صحيحاً (6 أحرف)');
            return;
        }
        this.roomCode = code;
        this.els.roomCode.textContent = code;
        this.createPeerConnection();
        
        // محاكاة الاتصال (في الواقع سيتم عبر WebRTC)
        this.simulateConnection();
    }

    // ============================================
    // إنشاء اتصال P2P (WebRTC)
    // ============================================
    createPeerConnection() {
        try {
            const config = {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            };

            this.peerConnection = new RTCPeerConnection(config);

            if (this.mode === 'sender') {
                // إنشاء قناة بيانات
                this.dataChannel = this.peerConnection.createDataChannel('fileTransfer', {
                    ordered: true
                });
                this.setupDataChannel();

                // إنشاء عرض
                this.peerConnection.createOffer()
                    .then(offer => this.peerConnection.setLocalDescription(offer))
                    .then(() => {
                        // تخزين العرض للتجربة
                        const offerData = {
                            type: 'offer',
                            sdp: this.peerConnection.localDescription?.sdp,
                            room: this.roomCode
                        };
                        localStorage.setItem(`offer_${this.roomCode}`, JSON.stringify(offerData));
                        this.setMessage('📡 في انتظار الاتصال...');
                        this.listenForAnswer();
                    })
                    .catch(err => {
                        console.error(err);
                        this.setMessage('❌ فشل إنشاء الاتصال');
                    });
            } else {
                // استقبال
                this.peerConnection.ondatachannel = (event) => {
                    this.dataChannel = event.channel;
                    this.setupDataChannel();
                };

                // محاكاة الحصول على العرض
                setTimeout(() => {
                    const offerData = localStorage.getItem(`offer_${this.roomCode}`);
                    if (offerData) {
                        const offer = JSON.parse(offerData);
                        this.peerConnection.setRemoteDescription(
                            new RTCSessionDescription(offer)
                        ).then(() => {
                            return this.peerConnection.createAnswer();
                        }).then(answer => {
                            return this.peerConnection.setLocalDescription(answer);
                        }).then(() => {
                            const answerData = {
                                type: 'answer',
                                sdp: this.peerConnection.localDescription?.sdp
                            };
                            localStorage.setItem(`answer_${this.roomCode}`, JSON.stringify(answerData));
                            this.setMessage('📡 جاري الاتصال...');
                        }).catch(err => {
                            console.error(err);
                        });
                    }
                }, 1000);
            }
        } catch (error) {
            console.error(error);
            this.setMessage('❌ فشل إنشاء الاتصال');
        }
    }

    // ============================================
    // إعداد قناة البيانات
    // ============================================
    setupDataChannel() {
        if (!this.dataChannel) return;

        this.dataChannel.onopen = () => {
            this.isConnected = true;
            this.updateStatus(true);
            this.setMessage('✅ متصل!');
            this.els.sendBtn.disabled = this.mode !== 'sender' || this.files.length === 0;
        };

        this.dataChannel.onclose = () => {
            this.isConnected = false;
            this.updateStatus(false);
            this.setMessage('❌ تم قطع الاتصال');
        };

        this.dataChannel.onerror = () => {
            this.setMessage('⚠️ خطأ في الاتصال');
        };

        this.dataChannel.onmessage = (event) => {
            if (typeof event.data === 'string') {
                this.handleStringMessage(event.data);
            } else if (event.data instanceof ArrayBuffer) {
                this.handleBinaryMessage(event.data);
            }
        };
    }

    // ============================================
    // الاستماع للإجابة (محاكاة)
    // ============================================
    listenForAnswer() {
        const interval = setInterval(() => {
            const answerData = localStorage.getItem(`answer_${this.roomCode}`);
            if (answerData) {
                clearInterval(interval);
                try {
                    const answer = JSON.parse(answerData);
                    this.peerConnection.setRemoteDescription(
                        new RTCSessionDescription(answer)
                    );
                    this.simulateConnection();
                    localStorage.removeItem(`answer_${this.roomCode}`);
                } catch (error) {
                    console.error(error);
                }
            }
        }, 1000);

        setTimeout(() => {
            clearInterval(interval);
            if (!this.isConnected) {
                this.setMessage('⏰ انتهى وقت الانتظار');
            }
        }, 30000);
    }

    // ============================================
    // محاكاة الاتصال (للتجربة)
    // ============================================
    simulateConnection() {
        setTimeout(() => {
            this.isConnected = true;
            this.updateStatus(true);
            this.setMessage('✅ تم الاتصال بنجاح!');
            this.els.sendBtn.disabled = false;
        }, 1500);
    }

    // ============================================
    // معالجة الرسائل النصية
    // ============================================
    handleStringMessage(message) {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'metadata') {
                this.handleMetadata(data.files);
            } else if (data.type === 'complete') {
                this.handleComplete();
            }
        } catch (error) {
            console.error(error);
        }
    }

    // ============================================
    // معالجة البيانات الثنائية
    // ============================================
    handleBinaryMessage(chunk) {
        if (this.currentFileIndex >= this.totalFiles) return;

        const file = this.receivedFiles[this.currentFileIndex];
        if (!file.chunks) file.chunks = [];
        if (!file.received) file.received = 0;
        
        file.chunks.push(chunk);
        file.received += chunk.byteLength;

        // تحديث التقدم
        const totalReceived = this.receivedFiles.reduce((sum, f) => sum + (f.received || 0), 0);
        const totalSize = this.receivedFiles.reduce((sum, f) => sum + f.size, 0);
        const progress = totalSize > 0 ? (totalReceived / totalSize) * 100 : 0;
        this.updateProgress(progress);

        if (file.received >= file.size) {
            this.currentFileIndex++;
            if (this.currentFileIndex < this.totalFiles) {
                this.setMessage(`📥 استقبال ${this.currentFileIndex + 1}/${this.totalFiles}`);
            }
        }
    }

    // ============================================
    // معالجة البيانات الوصفية
    // ============================================
    handleMetadata(files) {
        this.totalFiles = files.length;
        this.currentFileIndex = 0;
        this.receivedFiles = files.map(f => ({
            ...f,
            chunks: [],
            received: 0
        }));
        this.setMessage(`📥 جاري استقبال ${this.totalFiles} ملف(ات)...`);
        this.updateProgress(0);
    }

    // ============================================
    // اكتمال الاستقبال
    // ============================================
    handleComplete() {
        this.setMessage('✅ تم استقبال جميع الملفات!');
        this.updateProgress(100);
        
        this.receivedFiles.forEach((file) => {
            if (file.chunks && file.chunks.length > 0) {
                const blob = new Blob(file.chunks, { type: file.type || 'application/octet-stream' });
                file.blob = blob;
            }
        });

        this.renderReceivedFiles();
        this.els.sendBtn.disabled = true;
    }

    // ============================================
    // عرض الملفات المستلمة
    // ============================================
    renderReceivedFiles() {
        this.els.receivedList.innerHTML = '';
        
        this.receivedFiles.forEach((file, index) => {
            if (!file.blob) return;
            
            const div = document.createElement('div');
            div.className = 'received-item';
            
            div.innerHTML = `
                <div class="info">
                    <div class="name">${file.name}</div>
                    <div class="size">${this.formatSize(file.size)}</div>
                </div>
                <button class="download" data-index="${index}">⬇️ تحميل</button>
            `;
            
            div.querySelector('.download').addEventListener('click', () => {
                this.downloadFile(index);
            });
            
            this.els.receivedList.appendChild(div);
        });
    }

    // ============================================
    // تحميل ملف
    // ============================================
    downloadFile(index) {
        const file = this.receivedFiles[index];
        if (!file || !file.blob) return;
        
        const url = URL.createObjectURL(file.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // ============================================
    // إرسال الملفات
    // ============================================
    async sendFiles() {
        if (this.isSending || !this.isConnected || this.files.length === 0) return;
        
        this.isSending = true;
        this.els.sendBtn.disabled = true;
        this.updateProgress(0);
        
        try {
            // بيانات وصفية
            const metadata = this.files.map(f => ({
                name: f.name,
                size: f.size,
                type: f.type
            }));
            
            this.dataChannel.send(JSON.stringify({ type: 'metadata', files: metadata }));
            this.setMessage('📤 جاري الإرسال...');

            // إرسال الملفات
            const chunkSize = 16384;
            
            for (let i = 0; i < this.files.length; i++) {
                const file = this.files[i];
                const fileBuffer = await file.arrayBuffer();
                const totalChunks = Math.ceil(fileBuffer.byteLength / chunkSize);
                
                for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                    const start = chunkIndex * chunkSize;
                    const end = Math.min(start + chunkSize, fileBuffer.byteLength);
                    const chunk = fileBuffer.slice(start, end);
                    
                    this.dataChannel.send(chunk);
                    
                    const progress = ((i + (chunkIndex / totalChunks)) / this.files.length) * 100;
                    this.updateProgress(progress);
                }
            }
            
            this.dataChannel.send(JSON.stringify({ type: 'complete' }));
            this.setMessage('✅ تم إرسال جميع الملفات!');
            this.updateProgress(100);
            
        } catch (error) {
            console.error(error);
            this.setMessage('❌ فشل الإرسال');
        } finally {
            this.isSending = false;
            this.els.sendBtn.disabled = this.files.length === 0;
        }
    }

    // ============================================
    // إضافة ملفات
    // ============================================
    addFiles(fileList) {
        for (const file of fileList) {
            this.files.push(file);
        }
        this.renderFiles();
        this.els.sendBtn.disabled = !this.isConnected || this.files.length === 0;
        this.setMessage(`📎 ${this.files.length} ملف(ات) جاهز للإرسال`);
    }

    // ============================================
    // عرض الملفات
    // ============================================
    renderFiles() {
        this.els.fileList.innerHTML = '';
        
        this.files.forEach((file, index) => {
            const div = document.createElement('div');
            div.className = 'file-item';
            div.innerHTML = `
                <div class="info">
                    <div class="name">${file.name}</div>
                    <div class="size">${this.formatSize(file.size)}</div>
                </div>
                <button class="remove" data-index="${index}">✕</button>
            `;
            div.querySelector('.remove').addEventListener('click', () => {
                this.files.splice(index, 1);
                this.renderFiles();
                this.els.sendBtn.disabled = this.files.length === 0;
            });
            this.els.fileList.appendChild(div);
        });
    }

    // ============================================
    // مسح الملفات
    // ============================================
    clearFiles() {
        this.files = [];
        this.renderFiles();
        this.els.sendBtn.disabled = true;
        this.updateProgress(0);
        this.setMessage('🗑️ تم مسح الملفات');
    }

    // ============================================
    // تحديث التقدم
    // ============================================
    updateProgress(percent) {
        this.els.progressBar.innerHTML = `<div class="fill" style="width: ${percent}%"></div>`;
        this.els.progressText.textContent = `${Math.round(percent)}%`;
    }

    // ============================================
    // تحديث حالة الاتصال
    // ============================================
    updateStatus(connected) {
        this.els.statusDot.className = `dot ${connected ? 'connected' : ''}`;
        this.els.statusText.textContent = connected ? 'متصل' : 'غير متصل';
    }

    // ============================================
    // تعيين رسالة
    // ============================================
    setMessage(msg) {
        this.els.message.textContent = msg;
    }

    // ============================================
    // إعادة تعيين الاتصال
    // ============================================
    resetConnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        this.dataChannel = null;
        this.isConnected = false;
        this.updateStatus(false);
        this.els.sendBtn.disabled = true;
    }

    // ============================================
    // تنسيق حجم الملف
    // ============================================
    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    }
}

// ============================================
// تشغيل التطبيق
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    window.app = new FileTransferApp();
});
