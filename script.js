document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const previewGrid = document.getElementById('previewGrid');
    const controls = document.getElementById('controls');
    const convertBtn = document.getElementById('convertBtn');
    const clearBtn = document.getElementById('clearBtn');
    const formatSelect = document.getElementById('formatSelect');
    const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');

    let selectedFiles = [];

    // Theme Logic
    const currentTheme = localStorage.getItem('theme') ? localStorage.getItem('theme') : null;
    if (currentTheme) {
        document.documentElement.setAttribute('data-theme', currentTheme);
        if (currentTheme === 'light') {
            toggleSwitch.checked = true;
        }
    }

    toggleSwitch.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        }
    });

    // Trigger file input
    dropZone.addEventListener('click', () => fileInput.click());

    // File selection
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    function handleFiles(files) {
        const fileList = Array.from(files);
        
        fileList.forEach(file => {
            // Support more image types including svg, ico, tiff, avif
            const supportedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'image/svg+xml', 'image/x-icon', 'image/tiff', 'image/avif'];
            if (!supportedTypes.includes(file.type) && !file.name.match(/\.(png|jpg|jpeg|webp|bmp|svg|ico|tiff|avif)$/i)) return;
            
            if (selectedFiles.some(f => f.name === file.name && f.size === file.size)) return;

            selectedFiles.push(file);
            createPreview(file);
        });

        updateUI();
    }

    function createPreview(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.innerHTML = `
                <img src="${e.target.result}" alt="${file.name}">
                <div class="preview-info">
                    <div class="name">${file.name}</div>
                    <div class="size">${formatBytes(file.size)}</div>
                </div>
                <button class="remove-btn" title="Kaldır">&times;</button>
            `;

            div.querySelector('.remove-btn').addEventListener('click', () => {
                selectedFiles = selectedFiles.filter(f => f !== file);
                div.remove();
                updateUI();
            });

            previewGrid.appendChild(div);
        };
        reader.readAsDataURL(file);
    }

    function updateUI() {
        if (selectedFiles.length > 0) {
            controls.style.display = 'flex';
        } else {
            controls.style.display = 'none';
        }
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Conversion Logic
    convertBtn.addEventListener('click', async () => {
        const targetFormat = formatSelect.value;
        const extension = targetFormat.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg').replace('x-icon', 'ico');
        
        convertBtn.disabled = true;
        convertBtn.innerHTML = '<span>⏳</span> İşleniyor...';
        document.body.classList.add('loading');

        for (const file of selectedFiles) {
            try {
                const dataUrl = await convertImage(file, targetFormat);
                const fileName = file.name.split('.').slice(0, -1).join('.') + `.${extension}`;
                downloadLink(dataUrl, fileName);
            } catch (error) {
                console.error('Dönüştürme hatası:', error);
                alert(`${file.name} dönüştürülürken hata oluştu. Tarayıcınız bu formatı desteklemiyor olabilir.`);
            }
        }

        convertBtn.disabled = false;
        convertBtn.innerHTML = '<span>🚀</span> Dönüştür ve İndir';
        document.body.classList.remove('loading');
    });

    function convertImage(file, format) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    
                    // Handle transparency for non-transparent formats
                    if (format === 'image/jpeg' || format === 'image/bmp') {
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }
                    
                    ctx.drawImage(img, 0, 0);
                    
                    try {
                        const dataUrl = canvas.toDataURL(format, 0.9);
                        // Check if the browser actually supported the format
                        if (!dataUrl.startsWith(`data:${format}`)) {
                            throw new Error('Unsupported format');
                        }
                        resolve(dataUrl);
                    } catch (err) {
                        reject(err);
                    }
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function downloadLink(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    clearBtn.addEventListener('click', () => {
        selectedFiles = [];
        previewGrid.innerHTML = '';
        fileInput.value = '';
        updateUI();
    });
});
