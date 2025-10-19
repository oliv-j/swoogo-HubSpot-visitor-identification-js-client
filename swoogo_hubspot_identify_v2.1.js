<script>
(function(){
  var FORM_SEL = '#registrant-form';
  var EMAIL_SEL = '#registrant-email';
  var IDENT_KEY = 'hs_identified_email';
  var DEBUG = false;

  function log(){ if (DEBUG) try { console.log.apply(console, arguments); } catch(e){} }
  function isValidEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v||'').trim()); }
  function getEmail(){ var el = document.querySelector(EMAIL_SEL); return el ? (el.value||'').trim() : ''; }
  function getMarked(){ try { return sessionStorage.getItem(IDENT_KEY)||''; } catch(e){ return ''; } }
  function mark(email){ try { sessionStorage.setItem(IDENT_KEY, email||''); } catch(e){} }

  function identifyIfNeeded(){
    var email = getEmail();
    if (!isValidEmail(email) || getMarked() === email){
      log('[HS] skip identify; valid?', isValidEmail(email), 'marked:', getMarked());
      return;
    }
    window._hsq = window._hsq || [];
    _hsq.push(['identify', { email: email }]);
    _hsq.push(['trackPageView']);
    mark(email);
    log('[HS] queued identify + pageview for', email);
  }

  // 1) early: when Yii validates the email attribute and finds no errors
  jQuery(document).on('afterValidateAttribute.yiiActiveForm', FORM_SEL, function(e, attribute, messages, deferred, $form){
    try {
      // Yii passes an "attribute" object that includes input selector and messages array
      if (attribute && attribute.input === EMAIL_SEL) {
        var hasErrors = (messages && messages.length > 0);
        if (!hasErrors) identifyIfNeeded();
      }
    } catch(err){ log('[HS] afterValidateAttribute error', err); }
  });

  // 2) last-chance: immediately before Yii submits (form has passed all validation)
  jQuery(document).on('beforeSubmit.yiiActiveForm', FORM_SEL, function(e){
    try { identifyIfNeeded(); } catch(err){ log('[HS] beforeSubmit error', err); }
    // IMPORTANT: return true to allow Yii to proceed
    return true;
  });
})();
</script>

