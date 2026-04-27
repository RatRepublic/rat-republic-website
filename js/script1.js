document.addEventListener('DOMContentLoaded', function () {
    // Initialize Owl Carousel
    $(document).ready(function ($) {
        $('.owl-carousel').owlCarousel({
            loop: false,
            margin: 10,
            items: 5,
            autoWidth: true,
            nav: true,
            dots: false,
            responsive : {
                0 : {
                    items: 1
                },
                768 : {
                    items: 5
                }
            }
        });
    });

    // --- 1. VARIABLE DECLARATIONS (6 Traits) ---

    // OPTION LISTS
    const backgrounds = document.querySelectorAll('.outfit.background');
    const skins = document.querySelectorAll('.outfit.skin-item');
    const outfits = document.querySelectorAll('.outfit.clothing');
    const mouths = document.querySelectorAll('.outfit.mouth-item');
    const eyes = document.querySelectorAll('.outfit.face');
    const heads = document.querySelectorAll('.outfit.head-item');

    // OVERLAYS
    const backgroundOverlay = document.getElementById('background-overlay');
    const outfitOverlay = document.getElementById('outfit-overlay');
    const handOverlay = document.getElementById('hand-overlay');
    const mouthOverlay = document.getElementById('mouth-overlay');
    const eyesOverlay = document.getElementById('eyes-overlay');
    const headOverlay = document.getElementById('head-overlay');

    const resetButton = document.getElementById('reset-button');
    const downloadButton = document.getElementById('download-button');
    const randomizeButton = document.getElementById('randomize-button');
    const canvas = document.getElementById('canvas');
    const baseImage = document.getElementById('base');

    // CORS Settings
    baseImage.crossOrigin = "anonymous";
    backgroundOverlay.crossOrigin = "anonymous";
    outfitOverlay.crossOrigin = "anonymous";
    handOverlay.crossOrigin = "anonymous";
    mouthOverlay.crossOrigin = "anonymous";
    eyesOverlay.crossOrigin = "anonymous";
    headOverlay.crossOrigin = "anonymous";


    // --- 2. DRAW IMAGE ON CANVAS ---
    // Layer order bottom to top: background, base, skin, outfit, mouth, eyes, head
    function drawImageOnCanvas() {
        const context = canvas.getContext('2d');
        canvas.width = baseImage.naturalWidth;
        canvas.height = baseImage.naturalHeight;

        context.clearRect(0, 0, canvas.width, canvas.height);

        if (!backgroundOverlay.classList.contains('hidden') && backgroundOverlay.src) {
            context.drawImage(backgroundOverlay, 0, 0, canvas.width, canvas.height);
        }
        context.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
        if (!outfitOverlay.classList.contains('hidden') && outfitOverlay.src) {
            context.drawImage(outfitOverlay, 0, 0, canvas.width, canvas.height);
        }
        if (!handOverlay.classList.contains('hidden') && handOverlay.src) {
            context.drawImage(handOverlay, 0, 0, canvas.width, canvas.height);
        }
        if (!mouthOverlay.classList.contains('hidden') && mouthOverlay.src) {
            context.drawImage(mouthOverlay, 0, 0, canvas.width, canvas.height);
        }
        if (!eyesOverlay.classList.contains('hidden') && eyesOverlay.src) {
            context.drawImage(eyesOverlay, 0, 0, canvas.width, canvas.height);
        }
        if (!headOverlay.classList.contains('hidden') && headOverlay.src) {
            context.drawImage(headOverlay, 0, 0, canvas.width, canvas.height);
        }

        // Meme text overlay
        const memeText = document.getElementById('meme-text');
        if (memeText && memeText.value.trim()) {
            const text = memeText.value.trim();
            const fontSize = parseInt(document.getElementById('meme-size').value) || 30;
            const color = document.getElementById('meme-color').value || '#ffffff';
            const pos = document.getElementById('meme-pos').value;

            context.font = `bold ${fontSize}px Impact, Arial Black, sans-serif`;
            context.textAlign = 'center';
            context.lineWidth = fontSize / 8;
            context.strokeStyle = 'rgba(0,0,0,0.9)';
            context.fillStyle = color;

            const x = canvas.width / 2;
            const y = pos === 'top' ? fontSize + 10 : canvas.height - 14;

            context.strokeText(text, x, y);
            context.fillText(text, x, y);
        }
    }

    function addClickListener(elements, overlay) {
        elements.forEach(element => {
            element.addEventListener('click', function () {
                if (overlay.src === element.src && !overlay.classList.contains('hidden')) {
                    overlay.classList.add('hidden');
                    overlay.src = '';
                    drawImageOnCanvas();
                } else {
                    overlay.src = element.src;
                    overlay.onload = function () {
                        overlay.classList.remove('hidden');
                        drawImageOnCanvas();
                    };
                }
            });
        });
    }

    // Apply click listeners for all 6 traits
    addClickListener(backgrounds, backgroundOverlay);
    addClickListener(skins, outfitOverlay);
    addClickListener(outfits, handOverlay);
    addClickListener(mouths, mouthOverlay);
    addClickListener(eyes, eyesOverlay);
    addClickListener(heads, headOverlay);


    // --- 3. RANDOMIZE BUTTON ---

    function getRandomSrcOptional(elements) {
        if (Math.random() < 0.33) return null;
        if (elements.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * elements.length);
        return elements[randomIndex].src;
    }

    function getRandomSrcRequired(elements) {
        if (elements.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * elements.length);
        return elements[randomIndex].src;
    }

    function applyRandomLayer(elements, overlay, isRequired = false) {
        const randomSrc = isRequired ? getRandomSrcRequired(elements) : getRandomSrcOptional(elements);

        if (randomSrc) {
            overlay.src = randomSrc;
            overlay.onload = function () {
                overlay.classList.remove('hidden');
                drawImageOnCanvas();
            };
            if (overlay.complete) {
                overlay.classList.remove('hidden');
                drawImageOnCanvas();
            }
        } else {
            overlay.classList.add('hidden');
            overlay.src = '';
            drawImageOnCanvas();
        }
    }

    randomizeButton.addEventListener('click', function () {
        applyRandomLayer(backgrounds, backgroundOverlay, true);
        applyRandomLayer(skins, outfitOverlay, true);
        applyRandomLayer(outfits, handOverlay);
        applyRandomLayer(mouths, mouthOverlay, true);
        applyRandomLayer(eyes, eyesOverlay, true);
        applyRandomLayer(heads, headOverlay);
        drawImageOnCanvas();
    });


    // --- 4. RESET BUTTON ---
    resetButton.addEventListener('click', function () {
        backgroundOverlay.src = '';
        backgroundOverlay.classList.add('hidden');
        outfitOverlay.src = '';
        outfitOverlay.classList.add('hidden');
        handOverlay.src = '';
        handOverlay.classList.add('hidden');
        mouthOverlay.src = '';
        mouthOverlay.classList.add('hidden');
        eyesOverlay.src = '';
        eyesOverlay.classList.add('hidden');
        headOverlay.src = '';
        headOverlay.classList.add('hidden');
        drawImageOnCanvas();
    });


    // --- 5. DOWNLOAD BUTTON → opens share modal ---
    downloadButton.addEventListener('click', function () {
        drawImageOnCanvas();
        buildShareCanvas(function (shareCard) {
            const previewCanvas = document.getElementById('pfp-share-canvas');
            previewCanvas.width = shareCard.width;
            previewCanvas.height = shareCard.height;
            previewCanvas.getContext('2d').drawImage(shareCard, 0, 0);
            document.getElementById('pfp-modal').classList.remove('hidden');
        });
    });

    // --- SHARE MODAL ---
    // Card is 1080x1080. PFP window: ~820px wide, centered, starting ~195px from top.
    // Tweak PFP_SIZE, PFP_Y if the alignment needs adjustment after testing.
    function buildShareCanvas(callback) {
        const out = document.createElement('canvas');
        const frame = new Image();
        frame.crossOrigin = 'anonymous';
        frame.onload = function () {
            out.width = frame.naturalWidth;
            out.height = frame.naturalHeight;
            const ctx = out.getContext('2d');
            const pfpSize = Math.round(out.width * 0.61);  // ~659px of 1080
            const pfpX = Math.round((out.width - pfpSize) / 2);  // centered
            const pfpY = Math.round(out.height * 0.23);   // ~248px from top
            ctx.drawImage(canvas, pfpX, pfpY, pfpSize, pfpSize);
            ctx.drawImage(frame, 0, 0);
            callback(out);
        };
        frame.onerror = function () {
            out.width = canvas.width;
            out.height = canvas.height;
            out.getContext('2d').drawImage(canvas, 0, 0);
            callback(out);
        };
        frame.src = 'images/rat-pfp-card.png';
    }

    document.getElementById('pfp-modal-close').addEventListener('click', function () {
        document.getElementById('pfp-modal').classList.add('hidden');
    });

    document.getElementById('pfp-modal').addEventListener('click', function (e) {
        if (e.target === this) this.classList.add('hidden');
    });

    document.getElementById('pfp-download-pfp-btn').addEventListener('click', function () {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width  = 500;
        exportCanvas.height = 500;
        exportCanvas.getContext('2d').drawImage(canvas, 0, 0, 500, 500);
        exportCanvas.toBlob(function (blob) {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'rat-pfp.png';
            link.click();
            URL.revokeObjectURL(link.href);
        });
        document.getElementById('pfp-modal').classList.add('hidden');
    });

    document.getElementById('pfp-download-card-btn').addEventListener('click', function () {
        document.getElementById('pfp-share-canvas').toBlob(function (blob) {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'rat-republic-card.png';
            link.click();
            URL.revokeObjectURL(link.href);
        });
        document.getElementById('pfp-modal').classList.add('hidden');
    });

    document.getElementById('pfp-flaunt-btn').addEventListener('click', function () {
        const tweetText = encodeURIComponent('I am a certified Sewer Dweller, Viva Rat Republic!');
        const tweetUrl = 'https://twitter.com/intent/tweet?text=' + tweetText;
        document.getElementById('pfp-share-canvas').toBlob(function (blob) {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'rat-republic-card.png';
            link.click();
            URL.revokeObjectURL(link.href);
            setTimeout(function () { window.open(tweetUrl, '_blank'); }, 500);
        });
    });

    baseImage.onload = function () {
        drawImageOnCanvas();
    };

    if (baseImage.complete) {
        drawImageOnCanvas();
    }

    // --- 6. DAILY RAT ---
    function seededRand(seed) {
        var s = seed;
        return function() {
            s = (s * 1664525 + 1013904223) & 0xffffffff;
            return (s >>> 0) / 4294967296;
        };
    }

    const dailyButton = document.getElementById('daily-button');
    if (dailyButton) dailyButton.addEventListener('click', function () {
        const d = new Date();
        const dateStr = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
        const rand = seededRand(dateStr);

        function pickRequired(elements, overlay) {
            if (!elements.length) return;
            const idx = Math.floor(rand() * elements.length);
            const el = elements[idx];
            overlay.src = el.src;
            overlay.onload = function() { overlay.classList.remove('hidden'); drawImageOnCanvas(); };
            if (overlay.complete) { overlay.classList.remove('hidden'); drawImageOnCanvas(); }
        }

        pickRequired(backgrounds, backgroundOverlay);
        pickRequired(skins, outfitOverlay);
        pickRequired(outfits, handOverlay);
        pickRequired(mouths, mouthOverlay);
        pickRequired(eyes, eyesOverlay);
        pickRequired(heads, headOverlay);
        drawImageOnCanvas();
    });

    // --- 7. SHARE TO X ---
    const shareButton = document.getElementById('share-button');
    if (shareButton) shareButton.addEventListener('click', function () {
        drawImageOnCanvas();
        canvas.toBlob(function(blob) {
            const file = new File([blob], 'rat-pfp.png', { type: 'image/png' });
            const tweetText = encodeURIComponent('Just built my Rat Republic PFP! 🐀🔥 #RatRepublic #Solana');
            const tweetUrl = 'https://twitter.com/intent/tweet?text=' + tweetText;

            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                navigator.share({ title: 'My Rat Republic PFP', files: [file] });
            } else {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'rat-pfp.png';
                link.click();
                URL.revokeObjectURL(link.href);
                setTimeout(function() { window.open(tweetUrl, '_blank'); }, 500);
            }
        });
    });

    // --- 8. MEME TEXT LIVE PREVIEW ---
    const memeTextInput = document.getElementById('meme-text');
    const memeSizeInput = document.getElementById('meme-size');
    const memeColorInput = document.getElementById('meme-color');
    const memePosInput = document.getElementById('meme-pos');
    [memeTextInput, memeSizeInput, memeColorInput, memePosInput].forEach(function(el) {
        if (el) el.addEventListener('input', drawImageOnCanvas);
    });

    // --- 9. ITEM PREVIEW TOOLTIP ---
    const preview = document.getElementById('item-preview');
    const previewImg = preview.querySelector('img');

    document.querySelectorAll('.outfit').forEach(function (img) {
        img.addEventListener('mouseenter', function (e) {
            previewImg.src = img.src;
            preview.style.display = 'block';
        });
        img.addEventListener('mousemove', function (e) {
            preview.style.left = e.clientX + 'px';
            preview.style.top = e.clientY + 'px';
        });
        img.addEventListener('mouseleave', function () {
            preview.style.display = 'none';
            previewImg.src = '';
        });
    });
});
