importScripts('https://cdn.jsdelivr.net/npm/tweetnacl@1.0.3/nacl-fast.min.js');

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

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
    for (let i = digits.length - 1; i >= 0; i--) result += BASE58[digits[i]];
    return result;
}

self.onmessage = function (e) {
    const { prefix, suffix, caseSensitive } = e.data;
    const checkPrefix = caseSensitive ? prefix : prefix.toLowerCase();
    const checkSuffix = caseSensitive ? suffix : suffix.toLowerCase();
    let attempts = 0;

    while (true) {
        const kp = nacl.sign.keyPair();
        const address = base58Encode(kp.publicKey);
        attempts++;

        const checkAddr = caseSensitive ? address : address.toLowerCase();
        const prefixOk = !checkPrefix || checkAddr.startsWith(checkPrefix);
        const suffixOk = !checkSuffix || checkAddr.endsWith(checkSuffix);

        if (prefixOk && suffixOk) {
            self.postMessage({
                type: 'found',
                address: address,
                secretKey: Array.from(kp.secretKey),
                attempts: attempts
            });
            return;
        }

        if (attempts % 500 === 0) {
            self.postMessage({ type: 'progress', attempts: attempts });
        }
    }
};
