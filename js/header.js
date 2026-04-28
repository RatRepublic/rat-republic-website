(function () {
    var HEADER_H = 48;

    // ── Styles ────────────────────────────────────────────────────────────
    var css = document.createElement('style');
    css.textContent = [
        '@font-face {',
        '  font-family: "NftOpensea";',
        '  src: url("fonts/NftOpenseaRegular-jEJvR.ttf") format("truetype");',
        '}',
        '#rr-header {',
        '  position: fixed; top: 0; left: 0; right: 0; z-index: 9999;',
        '  height: ' + HEADER_H + 'px;',
        '  background: rgba(12,17,6,0.97);',
        '  border-bottom: 1px solid #3d5510;',
        '  backdrop-filter: blur(6px);',
        '  display: flex; align-items: center; justify-content: space-between;',
        '  padding: 0 20px; box-sizing: border-box;',
        '}',
        '#rr-header-brand {',
        '  color: #C8E030; text-decoration: none; font-family: "NftOpensea", monospace;',
        '  font-weight: bold; font-size: 0.82rem; letter-spacing: 2px;',
        '  white-space: nowrap; opacity: 0.85; transition: opacity 0.2s;',
        '}',
        '#rr-header-brand:hover { opacity: 1; color: #C8E030; }',

        /* Profile wrapper — anchors the dropdown */
        '#rr-header-profile-wrap {',
        '  position: relative;',
        '  display: inline-flex;',
        '}',

        '#rr-header-profile {',
        '  display: inline-flex; align-items: center; gap: 7px;',
        '  background: rgba(20,28,12,0.9); border: 1.5px solid #5A7A18;',
        '  border-radius: 20px; padding: 3px 12px 3px 4px;',
        '  text-decoration: none; transition: all 0.2s;',
        '  color: rgba(255,255,255,0.85); font-family: monospace; font-size: 0.78rem;',
        '  max-width: 200px; cursor: pointer;',
        '}',
        '#rr-header-profile-wrap:hover #rr-header-profile { border-color: #C8E030; color: #C8E030; }',

        '#rr-header-avatar {',
        '  width: 28px; height: 28px; border-radius: 50%;',
        '  background: #2a3510; border: 1.5px solid #5A7A18;',
        '  display: flex; align-items: center; justify-content: center;',
        '  font-size: 0.85rem; overflow: hidden; flex-shrink: 0;',
        '}',
        '#rr-header-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }',
        '#rr-header-uname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',

        /* Dropdown — starts flush with bottom of wrapper (no gap) so hover never breaks */
        '#rr-header-dropdown {',
        '  position: absolute; top: 100%; right: 0;',
        '  padding-top: 6px;',
        '  opacity: 0; pointer-events: none;',
        '  transform: translateY(-4px);',
        '  transition: opacity 0.18s, transform 0.18s;',
        '  z-index: 10000;',
        '}',
        '#rr-header-dropdown-inner {',
        '  background: rgba(12,17,6,0.98); border: 1.5px solid #5A7A18;',
        '  border-radius: 10px; min-width: 140px; overflow: hidden;',
        '}',
        '#rr-header-profile-wrap:hover #rr-header-dropdown {',
        '  opacity: 1; pointer-events: auto; transform: translateY(0);',
        '}',
        '.rr-dd-item {',
        '  display: block; padding: 9px 16px;',
        '  color: rgba(255,255,255,0.75); text-decoration: none;',
        '  font-family: monospace; font-size: 0.78rem; letter-spacing: 1px;',
        '  cursor: pointer; border: none; background: none; width: 100%; text-align: left;',
        '  transition: background 0.15s, color 0.15s;',
        '}',
        '.rr-dd-item:hover { background: rgba(200,224,48,0.08); color: #C8E030; }',
        '.rr-dd-item + .rr-dd-item { border-top: 1px solid rgba(90,122,24,0.35); }',

        '#rr-header-login {',
        '  background: rgba(20,28,12,0.9); border: 1.5px solid #5A7A18;',
        '  color: #C8E030; text-decoration: none; font-family: monospace;',
        '  font-size: 0.78rem; padding: 6px 14px; border-radius: 8px;',
        '  transition: all 0.2s; letter-spacing: 1px;',
        '}',
        '#rr-header-login:hover { border-color: #C8E030; box-shadow: 0 0 8px rgba(200,224,48,0.2); }',

        '#rr-header-right { display: flex; align-items: center; gap: 10px; }',
        '#rr-header-home {',
        '  background: rgba(20,28,12,0.9); border: 1.5px solid #5A7A18;',
        '  color: #C8E030; text-decoration: none; font-family: monospace;',
        '  font-size: 0.78rem; padding: 6px 14px; border-radius: 8px;',
        '  transition: all 0.2s; letter-spacing: 1px; white-space: nowrap;',
        '}',
        '#rr-header-home:hover { border-color: #C8E030; box-shadow: 0 0 8px rgba(200,224,48,0.2); }',
        '#rr-header-utilities {',
        '  background: rgba(20,28,12,0.9); border: 1.5px solid #5A7A18;',
        '  color: #C8E030; text-decoration: none; font-family: monospace;',
        '  font-size: 0.78rem; padding: 6px 14px; border-radius: 8px;',
        '  transition: all 0.2s; letter-spacing: 1px; white-space: nowrap;',
        '}',
        '#rr-header-utilities:hover { border-color: #C8E030; box-shadow: 0 0 8px rgba(200,224,48,0.2); }',
        '#rr-header-leaderboard {',
        '  background: rgba(20,28,12,0.9); border: 1.5px solid #5A7A18;',
        '  color: #C8E030; text-decoration: none; font-family: monospace;',
        '  font-size: 0.78rem; padding: 6px 14px; border-radius: 8px;',
        '  transition: all 0.2s; letter-spacing: 1px; white-space: nowrap;',
        '}',
        '#rr-header-leaderboard:hover { border-color: #C8E030; box-shadow: 0 0 8px rgba(200,224,48,0.2); }',
    ].join('\n');
    document.head.appendChild(css);

    // ── Push page content below the fixed header ──────────────────────
    var existingPT = parseFloat(window.getComputedStyle(document.body).paddingTop) || 0;
    document.body.style.paddingTop = (existingPT + HEADER_H + 12) + 'px';

    // ── Build header element ──────────────────────────────────────────
    var header = document.createElement('div');
    header.id = 'rr-header';

    var brand = document.createElement('a');
    brand.id = 'rr-header-brand';
    brand.href = 'index.html';
    brand.textContent = 'RAT REPUBLIC';
    header.appendChild(brand);

    // ── Right-side container ──────────────────────────────────────────
    var rightSide = document.createElement('div');
    rightSide.id = 'rr-header-right';

    var homeLink = document.createElement('a');
    homeLink.id = 'rr-header-home';
    homeLink.href = 'index.html';
    homeLink.textContent = 'Home';
    rightSide.appendChild(homeLink);

    var utilitiesLink = document.createElement('a');
    utilitiesLink.id = 'rr-header-utilities';
    utilitiesLink.href = 'tools.html';
    utilitiesLink.textContent = 'Utilities';
    rightSide.appendChild(utilitiesLink);

    var leaderboardLink = document.createElement('a');
    leaderboardLink.id = 'rr-header-leaderboard';
    leaderboardLink.href = 'leaderboard.html';
    leaderboardLink.textContent = 'Crowned Vermins';
    rightSide.appendChild(leaderboardLink);

    var token    = localStorage.getItem('rr_token');
    var username = localStorage.getItem('rr_username');

    if (token && username) {
        var wrap = document.createElement('div');
        wrap.id = 'rr-header-profile-wrap';

        // Clickable profile pill
        var profileLink = document.createElement('a');
        profileLink.id = 'rr-header-profile';
        profileLink.href = 'profile.html';

        var avatarEl = document.createElement('div');
        avatarEl.id = 'rr-header-avatar';
        avatarEl.textContent = '🐀';

        var nameEl = document.createElement('span');
        nameEl.id = 'rr-header-uname';
        nameEl.textContent = username.length > 16 ? username.slice(0, 16) + '…' : username;

        profileLink.appendChild(avatarEl);
        profileLink.appendChild(nameEl);
        wrap.appendChild(profileLink);

        // Hover dropdown
        var dropdown = document.createElement('div');
        dropdown.id = 'rr-header-dropdown';

        var inner = document.createElement('div');
        inner.id = 'rr-header-dropdown-inner';

        var ddProfile = document.createElement('a');
        ddProfile.className = 'rr-dd-item';
        ddProfile.href = 'profile.html';
        ddProfile.textContent = 'Profile';

        var ddLogout = document.createElement('button');
        ddLogout.className = 'rr-dd-item';
        ddLogout.textContent = 'Log Out';
        ddLogout.addEventListener('click', function () {
            var t = localStorage.getItem('rr_token');
            localStorage.removeItem('rr_token');
            localStorage.removeItem('rr_username');
            localStorage.removeItem('rr_avatar');
            if (t) {
                fetch('api/auth.php?action=logout', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + t }
                }).catch(function () {});
            }
            window.location.href = 'index.html';
        });

        inner.appendChild(ddProfile);
        inner.appendChild(ddLogout);
        dropdown.appendChild(inner);
        wrap.appendChild(dropdown);

        rightSide.appendChild(wrap);

        // Load avatar
        var cachedAvatar = localStorage.getItem('rr_avatar');
        if (cachedAvatar) {
            var img = document.createElement('img');
            img.src = cachedAvatar;
            img.onerror = function () { avatarEl.textContent = '🐀'; };
            avatarEl.textContent = '';
            avatarEl.appendChild(img);
        } else {
            fetch('api/me.php', { headers: { 'Authorization': 'Bearer ' + token } })
                .then(function (r) { return r.ok ? r.json() : null; })
                .then(function (d) {
                    if (d && d.avatar) {
                        localStorage.setItem('rr_avatar', d.avatar);
                        var img = document.createElement('img');
                        img.src = d.avatar;
                        avatarEl.textContent = '';
                        avatarEl.appendChild(img);
                    }
                })
                .catch(function () {});
        }
    } else {
        var loginLink = document.createElement('a');
        loginLink.id = 'rr-header-login';
        loginLink.href = 'login.html';
        loginLink.textContent = 'Log In';
        rightSide.appendChild(loginLink);
    }

    header.appendChild(rightSide);
    document.body.insertBefore(header, document.body.firstChild);
})();
