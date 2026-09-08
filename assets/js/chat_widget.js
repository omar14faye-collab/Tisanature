/* ══════════════════════════════════════════════════
   TISANATURE — Chat Widget Client (version corrigée)
   À ajouter dans assets/js/chat_widget.js
   À inclure dans index.html avant </body> :
   <script src="assets/js/chat-widget.js"></script>

   CORRECTIFS :
   [FIX-1] Endpoint API séparé : api/chat.php (pas api/messages.php
           qui exige l'auth admin). Voir api/chat.php.
   [FIX-2] Suppression du bloc mort `else if` dans fetchNewMessages.
   [FIX-3] Mise à jour correcte de lastMsgId pour les messages client.
   [FIX-4] Auto-resize textarea sur reset après envoi.
   [FIX-5] Désactivation complète du bouton pendant l'envoi pour
           bloquer les double-soumissions.
══════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Config ────────────────────────────────────── */
  const SITE_BASE = typeof window.__TN_SITE_BASE__ === 'string' ? window.__TN_SITE_BASE__ : '';
  const API_CHAT = SITE_BASE + '/api/chat.php';
  const POLL_MS  = 4000;

  let sessionId = localStorage.getItem('tn_session_id');
  if (!sessionId) {
    sessionId = 'tn_' + Math.random().toString(36).substr(2, 12) + '_' + Date.now();
    localStorage.setItem('tn_session_id', sessionId);
  }

  let lastMsgId = 0;
  let pollTimer = null;
  let isOpen    = false;
  let infoGiven = false;

  /* ── Styles ─────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    #tn-chat-btn {
      position: fixed;
      bottom: max(clamp(18px, 3vw, 28px), env(safe-area-inset-bottom, 0px));
      right: max(clamp(18px, 3vw, 28px), env(safe-area-inset-right, 0px));
      z-index: 8000;
      width: clamp(44px, 9vw, 56px); height: clamp(44px, 9vw, 56px); border-radius: 50%;
      background: linear-gradient(135deg, #3A7D5C, #6BB892);
      border: none; cursor: pointer;
      box-shadow: 0 6px 24px rgba(58,125,92,.45);
      display: flex; align-items: center; justify-content: center;
      transition: transform .2s, box-shadow .2s;
    }
    #tn-chat-btn:hover { transform: scale(1.08); box-shadow: 0 8px 30px rgba(58,125,92,.6); }
    #tn-chat-btn svg { width: clamp(18px, 4vw, 26px); height: clamp(18px, 4vw, 26px); fill: #fff; }
    #tn-chat-notif {
      position: absolute; top: -3px; right: -3px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #C25147; color: #fff;
      font-size: .62rem; font-weight: 700;
      align-items: center; justify-content: center;
      border: 2px solid #0C1A14;
      display: none;
    }
    #tn-chat-win {
      position: fixed; bottom: 96px; right: 28px; z-index: 8000;
      width: min(340px, calc(100vw - 16px));
      max-height: min(520px, calc(100dvh - 140px), calc(100vh - 140px));
      background: #112018; border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,.55);
      display: flex; flex-direction: column; overflow: hidden;
      transform: scale(.9) translateY(20px); opacity: 0;
      pointer-events: none;
      transition: transform .22s cubic-bezier(.22,1,.36,1), opacity .22s;
    }
    #tn-chat-win.open { transform: scale(1) translateY(0); opacity: 1; pointer-events: all; }
    @media (max-width: 400px) {
      #tn-chat-win {
        right: max(8px, env(safe-area-inset-right, 0px));
        left: max(8px, env(safe-area-inset-left, 0px));
        width: auto;
        bottom: max(72px, env(safe-area-inset-bottom, 0px));
        max-height: min(520px, calc(100dvh - 120px), calc(100vh - 120px));
      }
    }
    #tn-chat-hdr {
      padding: 12px 14px;
      background: linear-gradient(135deg, #1E3627, #3A7D5C);
      display: flex; align-items: center; gap: 8px; flex-shrink: 0;
    }
    .tn-chat-avatar {
      width: clamp(30px, 7vw, 36px); height: clamp(30px, 7vw, 36px); border-radius: 50%;
      background: rgba(255,255,255,0.15);
      display: flex; align-items: center; justify-content: center;
      font-size: clamp(1rem, 2.5vw, 1.2rem); flex-shrink: 0;
    }
    #tn-chat-hdr-info { flex: 1; }
    #tn-chat-hdr-name { font-family: 'Playfair Display',serif; font-size: clamp(.82rem, 2.2vw, .9rem); color: #EDE8DC; }
    #tn-chat-hdr-sub  { font-size: clamp(.6rem, 1.7vw, .65rem); color: rgba(255,255,255,.55); margin-top: 1px; }
    .tn-online-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #3DD68C; box-shadow: 0 0 6px #3DD68C;
      animation: tn-pulse-dot 2s infinite;
    }
    @keyframes tn-pulse-dot { 0%,100%{opacity:1} 50%{opacity:.4} }
    #tn-chat-close {
      background: none; border: none; color: rgba(255,255,255,.6);
      cursor: pointer; font-size: 18px; padding: 2px 6px; transition: color .15s;
    }
    #tn-chat-close:hover { color: #fff; }
    #tn-chat-msgs {
      flex: 1; min-height: 0; overflow-y: auto; padding: 12px 10px;
      /* PERF: éviter flex+gap sur une longue liste (scroll plus fluide). */
      display: block;
      /* On pilote le scroll via JS (auto uniquement si l'utilisateur est déjà en bas). */
      scroll-behavior: auto;
      scrollbar-width: thin; scrollbar-color: #243E2E #0C1A14;
      contain: content;
    }
    #tn-chat-msgs::-webkit-scrollbar { width: 3px; }
    #tn-chat-msgs::-webkit-scrollbar-thumb { background: #243E2E; border-radius: 99px; }
    .tn-msg { max-width: 82%; padding: 8px 11px; border-radius: 12px; font-size: clamp(.72rem, 1.3vw, .8rem); line-height: 1.55; word-break: break-word; margin: 0 0 6px 0; }
    .tn-msg-client { background: linear-gradient(135deg, #3A7D5C, #4F9B75); color: #fff; margin-left: auto; border-bottom-right-radius: 3px; }
    .tn-msg-admin  { background: #1E3627; border: 1px solid rgba(255,255,255,0.08); color: #DDD9CE; margin-right: auto; border-bottom-left-radius: 3px; }
    .tn-msg-time   { font-size: .57rem; opacity: .55; margin-top: 4px; text-align: right; }
    .tn-msg-admin .tn-msg-time { text-align: left; }
    .tn-msg-system {
      margin: 6px auto; font-size: .67rem; color: #636059;
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
      padding: 5px 12px; border-radius: 99px;
    }
    #tn-chat-info-form {
      padding: 12px 10px; background: #0E1F17;
      border-top: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
    }
    #tn-chat-info-form p { font-size: clamp(.68rem, 1.3vw, .72rem); color: #9E9A91; margin-bottom: 7px; line-height: 1.5; }
    .tn-info-input {
      width: 100%; background: #182C20; border: 1px solid rgba(255,255,255,0.09);
      border-radius: 7px; padding: 7px 10px; color: #DDD9CE;
      font-size: clamp(.72rem, 1.2vw, .78rem); font-family: 'Karla',sans-serif;
      outline: none; margin-bottom: 5px; transition: border-color .15s;
    }
    .tn-info-input:focus { border-color: #4F9B75; }
    .tn-info-btn {
      width: 100%; padding: 8px; border: none; border-radius: 7px;
      background: linear-gradient(135deg, #3A7D5C, #4F9B75);
      color: #fff; font-size: .78rem; font-weight: 600;
      cursor: pointer; transition: opacity .15s;
    }
    .tn-info-btn:hover { opacity: .9; }
    #tn-chat-input-area {
      padding: 8px 10px; border-top: 1px solid rgba(255,255,255,0.06);
      display: flex; gap: 6px; align-items: flex-end; flex-shrink: 0;
    }
    #tn-chat-input {
      flex: 1; background: #182C20; border: 1px solid rgba(255,255,255,0.09);
      border-radius: 9px; padding: 8px 10px; color: #DDD9CE;
      font-size: clamp(.72rem, 1.3vw, .8rem); font-family: 'Karla',sans-serif;
      outline: none; resize: none; max-height: clamp(60px, 18vh, 110px);
      transition: border-color .15s; line-height: 1.45;
    }
    #tn-chat-input:focus { border-color: #4F9B75; }
    #tn-chat-send {
      width: clamp(32px, 7vw, 36px); height: clamp(32px, 7vw, 36px); border-radius: 8px; border: none;
      background: linear-gradient(135deg, #3A7D5C, #4F9B75);
      color: #fff; cursor: pointer; display: flex; align-items: center;
      justify-content: center; flex-shrink: 0; transition: opacity .15s;
    }
    #tn-chat-send:hover { opacity: .85; }
    #tn-chat-send svg { width: 16px; height: 16px; fill: #fff; }
    #tn-chat-send:disabled { opacity: .4; cursor: not-allowed; }
  `;
  document.head.appendChild(style);

  /* ── HTML ────────────────────────────────────────── */
  const container = document.createElement('div');
  container.innerHTML = `
    <button id="tn-chat-btn" aria-label="Ouvrir le chat">
      <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      <span id="tn-chat-notif" aria-live="polite" aria-label="Messages non lus"></span>
    </button>
    <div id="tn-chat-win" role="dialog" aria-label="Chat TISANATURE">
      <div id="tn-chat-hdr">
        <div class="tn-chat-avatar" aria-hidden="true">🌿</div>
        <div id="tn-chat-hdr-info">
          <div id="tn-chat-hdr-name">TISANATURE</div>
          <div id="tn-chat-hdr-sub"><span class="tn-online-dot" style="display:inline-block;vertical-align:middle;margin-right:4px" aria-hidden="true"></span>En ligne</div>
        </div>
        <button id="tn-chat-close" aria-label="Fermer le chat">✕</button>
      </div>
      <div id="tn-chat-msgs" role="log" aria-live="polite" aria-label="Messages du chat"></div>
      <div id="tn-chat-info-form">
        <p>Bonjour ! Pour mieux vous aider, présentez-vous :</p>
        <input class="tn-info-input" id="tn-info-name"  type="text" placeholder="Votre prénom *" maxlength="80" aria-required="true">
        <input class="tn-info-input" id="tn-info-phone" type="tel"  placeholder="Téléphone (optionnel)">
        <button class="tn-info-btn" onclick="tnStartChat()">Démarrer la conversation →</button>
      </div>
      <div id="tn-chat-input-area" style="display:none">
        <textarea
          id="tn-chat-input"
          placeholder="Écrivez votre message…"
          rows="1"
          aria-label="Zone de saisie du message"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();tnSendMessage();}"
          oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,80)+'px'"></textarea>
        <button id="tn-chat-send" onclick="tnSendMessage()" title="Envoyer" aria-label="Envoyer le message">
          <svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z"/></svg>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  /* ── Utilitaires ─────────────────────────────────── */
  const $c  = id => document.getElementById(id);
  const fmt = d  => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  function escMsg(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  function addMsg(sender, content, time, system) {
    system = system || false;
    const wrap = $c('tn-chat-msgs');
    if (!wrap) return;

    // Ne force pas le scroll si l'utilisateur est en train de lire plus haut.
    // (Sinon, l'affichage "saute" à chaque nouveau message).
    const isNearBottom = (wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight) < 40;
    const d = document.createElement('div');
    if (system) {
      d.className   = 'tn-msg tn-msg-system';
      d.textContent = content;
    } else {
      d.className = 'tn-msg tn-msg-' + sender;
      d.innerHTML = '<div>' + escMsg(content) + '</div>'
                  + '<div class="tn-msg-time">' + (time ? fmt(time) : 'maintenant') + '</div>';
    }
    wrap.appendChild(d);

    if (isNearBottom) {
      // Laisse le navigateur calculer la hauteur avant de positionner le scroll.
      requestAnimationFrame(function () {
        wrap.scrollTop = wrap.scrollHeight;
      });
    }
  }

  /* ── Ouvrir / Fermer ─────────────────────────────── */
  $c('tn-chat-btn').addEventListener('click', function () { toggleChat(true); });
  $c('tn-chat-close').addEventListener('click', function () { toggleChat(false); });

  function toggleChat(open) {
    isOpen = (open === undefined) ? !isOpen : open;
    $c('tn-chat-win').classList.toggle('open', isOpen);
    if (isOpen) {
      var notif = $c('tn-chat-notif');
      notif.textContent = '';
      notif.style.display = 'none';
      if (infoGiven) startPolling();
      setTimeout(function () {
        var el = infoGiven ? $c('tn-chat-input') : $c('tn-info-name');
        if (el) el.focus();
      }, 200);
    } else {
      stopPolling();
    }
  }

  /* ── Démarrer après identification ────────────────── */
  window.tnStartChat = function () {
    var name  = $c('tn-info-name').value.trim();
    var phone = $c('tn-info-phone').value.trim();
    if (!name) { $c('tn-info-name').focus(); return; }

    localStorage.setItem('tn_chat_name',  name);
    localStorage.setItem('tn_chat_phone', phone);
    infoGiven = true;

    $c('tn-chat-info-form').style.display  = 'none';
    $c('tn-chat-input-area').style.display = 'flex';

    addMsg('', 'Conversation démarrée', null, true);
    addMsg('admin', 'Bonjour ' + name + ' ! 👋 Bienvenue chez TISANATURE. Comment puis-je vous aider ?', null);

    setTimeout(function () { if ($c('tn-chat-input')) $c('tn-chat-input').focus(); }, 100);
    startPolling();
  };

  /* Pré-remplir si données connues */
  var savedName = localStorage.getItem('tn_chat_name');
  if (savedName) {
    $c('tn-info-name').value  = savedName;
    $c('tn-info-phone').value = localStorage.getItem('tn_chat_phone') || '';
    infoGiven = true;
    $c('tn-chat-info-form').style.display  = 'none';
    $c('tn-chat-input-area').style.display = 'flex';
  }

  /* ── Envoyer un message ──────────────────────────── */
  /* [FIX-5] Bouton désactivé AVANT le fetch pour bloquer les double-soumissions */
  window.tnSendMessage = async function () {
    var input   = $c('tn-chat-input');
    var sendBtn = $c('tn-chat-send');
    var content = input.value.trim();
    if (!content || sendBtn.disabled) return;

    var name  = localStorage.getItem('tn_chat_name')  || 'Visiteur';
    var phone = localStorage.getItem('tn_chat_phone') || '';

    /* Afficher immédiatement côté client */
    addMsg('client', content, null);

    /* [FIX-4] Reset + resize après affichage */
    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;

    try {
      var res = await fetch(API_CHAT + '?action=send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, content: content, name: name, phone: phone }),
      });

      /* Lire la réponse même en cas d'erreur HTTP pour avoir le message PHP exact */
      var rawText = await res.text().catch(function () { return ''; });
      var data = {};
      try { data = JSON.parse(rawText); } catch (e) {
        console.error('[TISANATURE chat] Réponse non-JSON (' + res.status + ') :', rawText.slice(0, 300));
        throw new Error('PHP a retourné une réponse invalide (' + res.status + '). Voir console F12.');
      }
      if (!res.ok || !data.success) {
        var msg = data.message || ('Erreur ' + res.status);
        console.error('[TISANATURE chat] Erreur (' + res.status + ') :', msg);
        throw new Error(msg);
      }

      if (data.msg_id && data.msg_id > lastMsgId) {
        lastMsgId = data.msg_id;
      }

    } catch (err) {
      console.error('[TISANATURE chat] Erreur envoi :', err.message);
      addMsg('', err.message || 'Erreur d\'envoi. Réessayez.', null, true);
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  };

  /* ── Polling des nouveaux messages ──────────────── */
  function startPolling() {
    stopPolling();
    fetchNewMessages();
    pollTimer = setInterval(fetchNewMessages, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  async function fetchNewMessages() {
    if (!infoGiven) return;
    try {
      /* [FIX-1] Appel vers api/chat.php */
      var res = await fetch(
        API_CHAT + '?action=history'
          + '&session_id=' + encodeURIComponent(sessionId)
          + '&since=' + lastMsgId
      );
      var data = await res.json().catch(function () { return {}; });
      if (!data.success || !data.messages || !data.messages.length) return;

      data.messages.forEach(function (msg) {
        if (msg.id <= lastMsgId) return;
        /* [FIX-3] Mise à jour de lastMsgId pour TOUS les messages (client ET admin) */
        lastMsgId = msg.id;

        /* Afficher uniquement les réponses admin (les msgs client sont déjà affichés) */
        if (msg.sender === 'admin') {
          addMsg('admin', msg.content, msg.created_at);
          if (!isOpen) {
            var notif   = $c('tn-chat-notif');
            var current = parseInt(notif.textContent, 10) || 0;
            notif.textContent = current + 1;
            notif.style.display = 'flex';
          }
        }
        /* [FIX-2] Suppression du bloc mort else-if qui ne faisait rien */
      });
    } catch (e) {
      /* Silencieux — le polling peut échouer temporairement */
    }
  }

  /* Synchroniser lastMsgId au chargement si une conversation existe déjà */
  if (sessionId) {
    fetch(API_CHAT + '?action=history&session_id=' + encodeURIComponent(sessionId) + '&since=0')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success && data.messages && data.messages.length) {
          data.messages.forEach(function (msg) {
            if (msg.id > lastMsgId) lastMsgId = msg.id;
          });
        }
      })
      .catch(function () {});
  }

})();