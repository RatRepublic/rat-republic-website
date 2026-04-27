const CA = 'GDed8yyNJrHxZvYPAcP2sR4W2LCtF6eKnA1wdUaBpump';

function fetchTicker() {
    fetch('https://api.dexscreener.com/latest/dex/tokens/' + CA)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var pair = data.pairs && data.pairs[0];
            if (!pair) return;

            var price = parseFloat(pair.priceUsd);
            var priceStr = price < 0.0001
                ? price.toExponential(2)
                : price < 1 ? price.toFixed(6) : price.toFixed(4);

            var change = pair.priceChange && pair.priceChange.h24;
            var changeNum = parseFloat(change) || 0;
            var changeStr = (changeNum >= 0 ? '▲ ' : '▼ ') + Math.abs(changeNum).toFixed(2) + '%';
            var changeColor = changeNum >= 0 ? '#C8E030' : '#ff5555';

            var mcap = pair.fdv;
            var mcapStr = mcap
                ? (mcap >= 1e6 ? '$' + (mcap / 1e6).toFixed(2) + 'M' : '$' + (mcap / 1e3).toFixed(1) + 'K')
                : '';

            var el = document.getElementById('ticker-price');
            var elChange = document.getElementById('ticker-change');
            var elMcap = document.getElementById('ticker-mcap');

            if (el) el.textContent = '$' + priceStr;
            if (elChange) { elChange.textContent = changeStr; elChange.style.color = changeColor; }
            if (elMcap && mcapStr) elMcap.textContent = 'MC ' + mcapStr;
        })
        .catch(function() {});
}

function copyCA() {
    navigator.clipboard.writeText(CA).then(function() {
        var btn = document.getElementById('copy-ca-btn');
        var original = btn.textContent;
        btn.textContent = 'Copied!';
        btn.style.borderColor = '#C8E030';
        setTimeout(function() {
            btn.textContent = original;
            btn.style.borderColor = '';
        }, 2000);
    });
}

fetchTicker();
setInterval(fetchTicker, 30000);
