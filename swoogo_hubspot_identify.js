<script>
/* was originally titled hubspot_hs_identify_client */
<script>
(function () {
  /* ====== CONFIG ====== */
  var EMAIL_SELECTOR = '#registrant-email';
  var IDENTIFIED_FLAG = 'hs_identified_once';
  var HOLD_MS = 800;           // try 600–900ms
  var FAILSAFE_MS = 1200;      // absolute max hold
  var DEBUG = false;           // set true to see console logs

  /* ====== UTILS ====== */
  function log(){ if (DEBUG) try { console.log.apply(console, arguments); } catch(e){} }
  function isValidEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v||'').trim()); }
  function getEmail(){ var el = document.querySelector(EMAIL_SELECTOR); return el ? (el.value||'').trim() : ''; }
  function alreadyIdentified(){ try { return sessionStorage.getItem(IDENTIFIED_FLAG)==='1'; } catch(e){ return false; } }
  function markIdentified(){ try { sessionStorage.setItem(IDENTIFIED_FLAG,'1'); } catch(e){} }

  function ensureIdentify(){
    var email = getEmail();
    if (!isValidEmail(email) || alreadyIdentified()){
      log('[HS] skip identify (valid?', isValidEmail(email), 'already?', alreadyIdentified(), ')');
      return Promise.resolve(false);
    }
    window._hsq = window._hsq || [];
    _hsq.push(['identify', { email: email }]);
    _hsq.push(['trackPageView']);
    markIdentified();
    log('[HS] queued identify + pageview for', email);
    return waitForHubSpotHit(HOLD_MS);
  }

  function waitForHubSpotHit(timeoutMs){
    var done=false, finish;
    var po;
    var p = new Promise(function(res){ finish=res; });

    function seenHs(entry){
      var n=(entry && (entry.name||'')).toLowerCase();
      return n.includes('track.hubspot.com') || n.includes('__ptq.gif') || n.includes('hs-analytics');
    }

    try {
      var entries = performance.getEntriesByType('resource')||[];
      if (entries.some(seenHs)){ done=true; finish(true); log('[HS] detected prior HS hit'); }
    } catch(e){}

    if (!done && 'PerformanceObserver' in window){
      try {
        po = new PerformanceObserver(function(list){
          var ok = (list.getEntries()||[]).some(seenHs);
          if (ok && !done){ done=true; finish(true); po.disconnect(); log('[HS] detected HS hit via PO'); }
        });
        po.observe({ type:'resource', buffered:true });
      } catch(e){}
    }

    setTimeout(function(){
      if (!done){
        done = true;
        if (po){ try { po.disconnect(); } catch(e){} }
        log('[HS] timeout, proceeding');
        finish(false);
      }
    }, Math.max(250, timeoutMs || 800));

    return p;
  }

  /* ====== SUBMITTER CAPTURE (works around missing evt.submitter) ====== */
  document.addEventListener('click', function(ev){
    var btn = ev.target && ev.target.closest('button, input[type="submit"]');
    if (!btn) return;
    var form = btn.form || btn.closest('form');
    if (form) form.__lastSubmitter = btn;
  }, true); // capture

  /* ====== MAIN SUBMIT INTERCEPT ====== */
  document.addEventListener('submit', function(evt){
    var form = evt.target;

    // Only hold on steps where the email field exists
    if (!document.querySelector(EMAIL_SELECTOR)) { log('[HS] no email on this step, let it pass'); return; }

    // If this is our resumed submit, don't intercept again
    if (form.__hs_resume__) { log('[HS] resumed submit, passing through'); return; }

    // Identify the original submitter (Safari-safe)
    var submitter = evt.submitter || form.__lastSubmitter || null;

    // Hold the submit
    evt.preventDefault();
    evt.stopPropagation();
    log('[HS] submit intercepted; submitter:', submitter);

    var released = false;

    function resume(){
      if (released) return;
      released = true;
      // guard to avoid re-intercepting
      form.__hs_resume__ = true;
      log('[HS] resuming submit with requestSubmit');
      try {
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit(submitter || undefined);
        } else if (submitter && submitter.click) {
          // Older browsers: re-click the original button
          setTimeout(function(){ submitter.click(); }, 0);
        } else {
          HTMLFormElement.prototype.submit.call(form);
        }
      } finally {
        setTimeout(function(){ try { delete form.__hs_resume__; } catch(e){} }, 0);
      }
    }

    // hard failsafe in case anything goes sideways
    var failsafe = setTimeout(function(){
      log('[HS] FAILSAFE fired — forcing resume');
      resume();
    }, FAILSAFE_MS);

    // try to identify, then resume
    Promise.resolve().then(ensureIdentify).catch(function(e){
      log('[HS] ensureIdentify error:', e);
    }).finally(function(){
      clearTimeout(failsafe);
      // small next-tick to avoid same-tick reentrancy with other handlers
      setTimeout(resume, 0);
    });

  }, true); // capture so we run before others
})();
</script>