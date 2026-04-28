document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const previewGrid = document.getElementById('previewGrid');
    const convertBtn = document.getElementById('convertBtn');
    const clearBtn = document.getElementById('clearBtn');
    const formatSelect = document.getElementById('formatSelect');
    const themeBtns = document.querySelectorAll('.theme-btn');
    const fileCountEl = document.getElementById('fileCount');
    const totalSizeEl = document.getElementById('totalSize');

    let selectedFiles = [];

    // --- Theme Logic ---
    const savedTheme = localStorage.getItem('tb-suite-theme') || 'dark';
    setTheme(savedTheme);

    themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.getAttribute('data-theme');
            setTheme(theme);
        });
    });

    function setTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('tb-suite-theme', theme);
        themeBtns.forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-theme') === theme);
        });
    }

    // --- File Handling ---
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    async function handleFiles(files) {
        const fileList = Array.from(files);
        
        for (const file of fileList) {
            if (selectedFiles.some(f => f.name === file.name && f.size === file.size)) continue;
            
            const fileData = {
                file: file,
                id: Math.random().toString(36).substr(2, 9),
                preview: null,
                resolution: 'Yükleniyor...',
                type: file.type || file.name.split('.').pop().toUpperCase()
            };

            selectedFiles.push(fileData);
            await createPreview(fileData);
        }
        updateUI();
    }

    async function createPreview(fileData) {
        const file = fileData.file;
        let previewUrl = '';

        try {
            if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
                // HEIC Support
                const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.5 });
                previewUrl = URL.createObjectURL(Array.isArray(blob) ? blob[0] : blob);
            } else if (file.name.toLowerCase().endsWith('.tiff') || file.name.toLowerCase().endsWith('.tif')) {
                // TIFF Support
                const buffer = await file.arrayBuffer();
                const ifds = UTIF.decode(buffer);
                UTIF.decodeImage(buffer, ifds[0]);
                const rgba = UTIF.toRGBA8(ifds[0]);
                const canvas = document.createElement('canvas');
                canvas.width = ifds[0].width;
                canvas.height = ifds[0].height;
                const ctx = canvas.getContext('2d');
                const imgData = ctx.createImageData(canvas.width, canvas.height);
                imgData.data.set(rgba);
                ctx.putImageData(imgData, 0, 0);
                previewUrl = canvas.toDataURL();
            } else if (file.type === 'application/pdf') {
                // PDF Support (First Page)
                const buffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({ data: buffer });
                const pdf = await loadingTask.promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 0.5 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({ canvasContext: context, viewport: viewport }).promise;
                previewUrl = canvas.toDataURL();
            } else {
                // Standard Formats
                previewUrl = await fileToDataURL(file);
            }

            fileData.preview = previewUrl;
            renderFileCard(fileData);
        } catch (err) {
            console.error('Preview error:', err);
            showToast(`${file.name} önizlemesi oluşturulamadı.`, 'error');
        }
    }

    function renderFileCard(fileData) {
        const card = document.createElement('div');
        card.className = 'file-card';
        card.id = `card-${fileData.id}`;
        card.innerHTML = `
            <button class="remove-file" onclick="removeFile('${fileData.id}')">&times;</button>
            <div class="card-preview">
                <img src="${fileData.preview}" alt="${fileData.file.name}">
            </div>
            <div class="file-info">
                <div class="file-name" title="${fileData.file.name}">${fileData.file.name}</div>
                <div class="file-meta">
                    <span class="file-size">${formatBytes(fileData.file.size)}</span>
                    <span class="file-badge">${fileData.type.replace('image/', '').toUpperCase()}</span>
                </div>
            </div>
        `;
        previewGrid.appendChild(card);
        
        // Get resolution
        const img = new Image();
        img.onload = () => {
            fileData.resolution = `${img.width}x${img.height}`;
            // Update UI if needed
        };
        img.src = fileData.preview;
    }

    window.removeFile = (id) => {
        selectedFiles = selectedFiles.filter(f => f.id !== id);
        const card = document.getElementById(`card-${id}`);
        if (card) card.remove();
        updateUI();
    };

    function updateUI() {
        fileCountEl.textContent = selectedFiles.length;
        const totalSize = selectedFiles.reduce((acc, curr) => acc + curr.file.size, 0);
        totalSizeEl.textContent = formatBytes(totalSize);
    }

    // --- Conversion Logic ---
    convertBtn.addEventListener('click', async () => {
        if (selectedFiles.length === 0) {
            showToast('Lütfen önce dosya ekleyin.', 'info');
            return;
        }

        const targetFormat = formatSelect.value;
        const extension = targetFormat.split('/')[1].replace('jpeg', 'jpg');
        
        convertBtn.disabled = true;
        convertBtn.innerHTML = '<span>⏳</span> Hazırlanıyor...';
        document.body.classList.add('loading');

        let successCount = 0;

        for (const fileData of selectedFiles) {
            try {
                const dataUrl = await convertImage(fileData, targetFormat);
                const fileName = fileData.file.name.split('.').slice(0, -1).join('.') + `_converted.${extension}`;
                downloadLink(dataUrl, fileName);
                successCount++;
            } catch (error) {
                console.error('Dönüştürme hatası:', error);
                showToast(`${fileData.file.name} dönüştürülemedi.`, 'error');
            }
        }

        showToast(`${successCount} dosya başarıyla dönüştürüldü!`, 'success');
        convertBtn.disabled = false;
        convertBtn.innerHTML = '<span>🚀</span> Dönüştür ve İndir';
        document.body.classList.remove('loading');
    });

    async function convertImage(fileData, format) {
        // Use the existing preview URL as a starting point if it's already a dataURL
        const img = new Image();
        img.src = fileData.preview;
        await new Promise(resolve => img.onload = resolve);

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        if (format === 'image/jpeg' || format === 'image/bmp') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        ctx.drawImage(img, 0, 0);
        
        const dataUrl = canvas.toDataURL(format, 0.9);
        if (!dataUrl.startsWith(`data:${format}`)) {
            throw new Error('Format not supported by browser');
        }
        return dataUrl;
    }

    // --- Utilities ---
    function fileToDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function downloadLink(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    clearBtn.addEventListener('click', () => {
        selectedFiles = [];
        previewGrid.innerHTML = '';
        fileInput.value = '';
        updateUI();
        showToast('Tüm liste temizlendi.', 'info');
    });
});
