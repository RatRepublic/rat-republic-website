(function () {
    const VALID_BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

    function base58Encode(bytes) {
        const digits = [0];
        for (let i = 0; i < bytes.length; i++) {
            let carry = bytes[i];
            for (let j = 0; j < digits.length; j++) {
                carry += digits[j] << 8;
                digits[j] = carry % 58;
                carry = (carry / 58) | 0;
            }
            while (carry > 0) {
                digits.push(carry % 58);
                carry = (carry / 58) | 0;
            }
        }
        let result = '';
        for (let i = 0; i < bytes.length && bytes[i] === 0; i++) result += '1';
        for (let i = digits.length - 1; i >= 0; i--) result += VALID_BASE58[digits[i]];
        return result;
    }

    const prefixInput    = document.getElementById('prefix-input');
    const suffixInput    = document.getElementById('suffix-input');
    const caseCheck      = document.getElementById('case-sensitive');
    const difficultyHint = document.getElementById('difficulty-hint');
    const startBtn       = document.getElementById('start-btn');
    const progressArea   = document.getElementById('progress-area');
    const attemptsEl     = document.getElementById('attempts-count');
    const speedEl        = document.getElementById('speed-count');
    const resultSection  = document.getElementById('result-section');
    const resultAddress  = document.getElementById('result-address');
    const secretKeyEl    = document.getElementById('secret-key');
    const revealBtn      = document.getElementById('reveal-btn');
    const downloadBtn    = document.getElementById('download-btn');
    const errorMsg       = document.getElementById('error-msg');

    let worker = null;
    let running = false;
    let foundSecretKey = null;
    let foundAddress = null;
    let lastAttempts = 0;
    let lastTime = null;

    function getDifficulty(len) {
        if (len <= 0) return '';
        if (len === 1) return 'Estimated time: < 1 second';
        if (len === 2) return 'Estimated time: ~10 seconds';
        if (len === 3) return 'Estimated time: ~10 minutes';
        if (len === 4) return 'Estimated time: ~9 hours';
        if (len === 5) return 'Estimated time: several days';
        return 'Estimated time: not recommended — weeks or longer';
    }

    function validateInput(val) {
        for (let i = 0; i < val.length; i++) {
            if (VALID_BASE58.indexOf(val[i]) === -1) return false;
        }
        return true;
    }

    function updateHint() {
        const len = prefixInput.value.length + suffixInput.value.length;
        difficultyHint.textContent = getDifficulty(len);
    }

    prefixInput.addEventListener('input', updateHint);
    suffixInput.addEventListener('input', updateHint);

    startBtn.addEventListener('click', function () {
        if (running) {
            stopWorker();
            return;
        }

        const prefix = prefixInput.value.trim();
        const suffix = suffixInput.value.trim();
        const caseSensitive = caseCheck.checked;

        errorMsg.textContent = '';

        if (!prefix && !suffix) {
            errorMsg.textContent = 'Enter at least a prefix or suffix.';
            return;
        }
        if (!validateInput(prefix) || !validateInput(suffix)) {
            errorMsg.textContent = 'Invalid characters. Base58 only: no 0, O, I or l.';
            return;
        }
        if (prefix.length + suffix.length > 5) {
            errorMsg.textContent = 'Combined length too long (max 5). Longer searches can take days.';
            return;
        }

        resultSection.classList.add('hidden');
        foundSecretKey = null;
        running = true;
        startBtn.textContent = 'Stop';
        startBtn.classList.add('running');
        progressArea.classList.remove('hidden');
        attemptsEl.textContent = '0';
        speedEl.textContent = '0';
        lastAttempts = 0;
        lastTime = Date.now();

        worker = new Worker('js/vanity-worker.js');
        worker.postMessage({ prefix, suffix, caseSensitive });

        worker.onmessage = function (e) {
            const data = e.data;
            if (data.type === 'progress') {
                const now = Date.now();
                const elapsed = (now - lastTime) / 1000;
                if (elapsed > 0) {
                    const speed = Math.round((data.attempts - lastAttempts) / elapsed);
                    speedEl.textContent = speed.toLocaleString();
                }
                attemptsEl.textContent = data.attempts.toLocaleString();
                lastAttempts = data.attempts;
                lastTime = Date.now();
            } else if (data.type === 'found') {
                attemptsEl.textContent = data.attempts.toLocaleString();
                foundSecretKey = data.secretKey;
                showResult(data.address, data.secretKey);
                stopWorker();
            }
        };
    });

    function stopWorker() {
        if (worker) { worker.terminate(); worker = null; }
        running = false;
        startBtn.textContent = 'Start';
        startBtn.classList.remove('running');
    }

    function showResult(address, secretKey) {
        foundAddress = address;
        resultAddress.textContent = address;
        secretKeyEl.textContent = base58Encode(secretKey);
        secretKeyEl.classList.add('blurred');
        revealBtn.textContent = 'Reveal';
        resultSection.classList.remove('hidden');
    }

    revealBtn.addEventListener('click', function () {
        if (secretKeyEl.classList.contains('blurred')) {
            secretKeyEl.classList.remove('blurred');
            revealBtn.textContent = 'Hide';
        } else {
            secretKeyEl.classList.add('blurred');
            revealBtn.textContent = 'Reveal';
        }
    });

    downloadBtn.addEventListener('click', function () {
        if (!foundSecretKey) return;
        const payload = {
            address:      foundAddress,
            privateKey:   base58Encode(foundSecretKey),
            keypairBytes: foundSecretKey
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'keypair.json';
        a.click();
        URL.revokeObjectURL(url);
    });
})();
