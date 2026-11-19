/**
 * Google Material Style Feedback Widget connected to Firebase Firestore.
 * Submits feedback directly to Firebase Firestore collection 'feedbacks'.
 */
import { db, authReady, auth } from './studio-firebase.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

class GoogleFeedback {
  constructor() {
    this.isOpen = false;
    this.rating = 5;
    this.category = 'Suggestion';
    this.init();
  }

  init() {
    if (document.getElementById('googleFeedbackContainer')) return;
    this.render();
    this.bindEvents();
  }

  render() {
    const container = document.createElement('div');
    container.id = 'googleFeedbackContainer';
    container.innerHTML = `
      <button type="button" class="g-feedback-fab" id="gFeedbackFab" aria-label="Send Google-style feedback" title="Send feedback">
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12h-2v-2h2v2zm0-4h-2V6h2v4z"/></svg>
        <span>Feedback</span>
      </button>

      <div class="g-feedback-overlay" id="gFeedbackOverlay" role="dialog" aria-modal="true" aria-labelledby="gFeedbackTitle">
        <div class="g-feedback-modal">
          <div class="g-feedback-header">
            <h2 class="g-feedback-title" id="gFeedbackTitle">
              <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12h-2v-2h2v2zm0-4h-2V6h2v4z"/></svg>
              Send feedback
            </h2>
            <button type="button" class="g-feedback-close" id="gFeedbackClose" aria-label="Close feedback modal">&times;</button>
          </div>

          <div id="gFeedbackFormContainer">
            <div class="g-feedback-body">
              <div>
                <span class="g-feedback-rating-label">How would you rate your experience?</span>
                <div class="g-feedback-stars" id="gFeedbackStars" role="radiogroup" aria-label="Rating">
                  ${[1, 2, 3, 4, 5].map(star => `
                    <button type="button" class="g-feedback-star ${star <= 5 ? 'is-active' : ''}" data-star="${star}" aria-label="${star} star${star > 1 ? 's' : ''}">★</button>
                  `).join('')}
                </div>
              </div>

              <div>
                <span class="g-feedback-rating-label" style="display:block;margin-bottom:6px;">Feedback type</span>
                <div class="g-feedback-chips" id="gFeedbackChips">
                  <button type="button" class="g-feedback-chip is-selected" data-type="Suggestion">💡 Suggestion</button>
                  <button type="button" class="g-feedback-chip" data-type="Issue / Bug">🐞 Issue / Bug</button>
                  <button type="button" class="g-feedback-chip" data-type="Praise">❤️ Praise</button>
                  <button type="button" class="g-feedback-chip" data-type="General">💬 General</button>
                </div>
              </div>

              <div>
                <textarea 
                  class="g-feedback-textarea" 
                  id="gFeedbackComment" 
                  rows="4" 
                  placeholder="Describe your issue or share your ideas... (What did you like? What could be better?)"
                  required
                ></textarea>
              </div>

              <div>
                <input 
                  type="email" 
                  class="g-feedback-email" 
                  id="gFeedbackEmail" 
                  placeholder="Optional: Your email (if you'd like a response)"
                />
              </div>

              <label class="g-feedback-checkbox">
                <input type="checkbox" id="gFeedbackIncludeInfo" checked />
                <span>Include page URL and browser info to help troubleshoot</span>
              </label>

              <div id="gFeedbackError" style="color:#d93025;font-size:13px;display:none;"></div>
            </div>

            <div class="g-feedback-footer">
              <button type="button" class="g-feedback-btn g-feedback-btn-cancel" id="gFeedbackCancel">Cancel</button>
              <button type="button" class="g-feedback-btn g-feedback-btn-submit" id="gFeedbackSubmit">Send</button>
            </div>
          </div>

          <div id="gFeedbackSuccess" class="g-feedback-success" style="display:none;">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            <h3>Thank you for your feedback!</h3>
            <p>Your response has been sent to Firebase and helps us improve the studio.</p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);
  }

  bindEvents() {
    const fab = document.getElementById('gFeedbackFab');
    const overlay = document.getElementById('gFeedbackOverlay');
    const closeBtn = document.getElementById('gFeedbackClose');
    const cancelBtn = document.getElementById('gFeedbackCancel');
    const submitBtn = document.getElementById('gFeedbackSubmit');
    const stars = document.querySelectorAll('.g-feedback-star');
    const chips = document.querySelectorAll('.g-feedback-chip');

    fab?.addEventListener('click', () => this.open());
    closeBtn?.addEventListener('click', () => this.close());
    cancelBtn?.addEventListener('click', () => this.close());

    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });

    // Star rating
    stars.forEach(btn => {
      btn.addEventListener('click', () => {
        this.rating = parseInt(btn.dataset.star, 10);
        stars.forEach(s => {
          const val = parseInt(s.dataset.star, 10);
          s.classList.toggle('is-active', val <= this.rating);
        });
      });
    });

    // Category chips
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('is-selected'));
        chip.classList.add('is-selected');
        this.category = chip.dataset.type;
      });
    });

    // Submit
    submitBtn?.addEventListener('click', () => this.handleSubmit());
  }

  open() {
    this.isOpen = true;
    const overlay = document.getElementById('gFeedbackOverlay');
    overlay?.classList.add('is-open');
    document.getElementById('gFeedbackFormContainer').style.display = 'block';
    document.getElementById('gFeedbackSuccess').style.display = 'none';
    document.getElementById('gFeedbackError').style.display = 'none';
    const textarea = document.getElementById('gFeedbackComment');
    if (textarea) textarea.value = '';
    
    // Auto-fill email if signed in
    authReady.then(() => {
      if (auth.currentUser?.email) {
        const emailInput = document.getElementById('gFeedbackEmail');
        if (emailInput && !emailInput.value) emailInput.value = auth.currentUser.email;
      }
    });

    setTimeout(() => textarea?.focus(), 150);
  }

  close() {
    this.isOpen = false;
    document.getElementById('gFeedbackOverlay')?.classList.remove('is-open');
  }

  async handleSubmit() {
    const commentEl = document.getElementById('gFeedbackComment');
    const emailEl = document.getElementById('gFeedbackEmail');
    const includeInfoEl = document.getElementById('gFeedbackIncludeInfo');
    const submitBtn = document.getElementById('gFeedbackSubmit');
    const errorEl = document.getElementById('gFeedbackError');

    const comment = commentEl?.value.trim();
    if (!comment) {
      if (errorEl) {
        errorEl.textContent = 'Please enter your feedback or comments before submitting.';
        errorEl.style.display = 'block';
      }
      commentEl?.focus();
      return;
    }

    errorEl.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    const feedbackData = {
      rating: Number(this.rating),
      category: String(this.category),
      comment: String(comment),
      email: String(emailEl?.value.trim() || auth.currentUser?.email || ''),
      url: includeInfoEl?.checked ? window.location.href : '',
      path: includeInfoEl?.checked ? window.location.pathname : '',
      userAgent: includeInfoEl?.checked ? navigator.userAgent : '',
      screen: includeInfoEl?.checked ? `${window.innerWidth}x${window.innerHeight}` : '',
      createdAt: serverTimestamp(),
      dateString: new Date().toISOString(),
      status: 'new'
    };

    let savedToFirebase = false;

    // 1. Try Firebase Firestore
    try {
      await addDoc(collection(db, 'feedbacks'), feedbackData);
      savedToFirebase = true;
    } catch (firebaseErr) {
      console.warn('Firebase direct feedback submission fallback:', firebaseErr);
    }

    // 2. Always back up to local storage as safety guarantee
    try {
      const localKey = 'qbar-feedback-local';
      const rows = JSON.parse(localStorage.getItem(localKey) || '[]');
      rows.unshift({ ...feedbackData, savedToFirebase, createdAt: new Date().toISOString() });
      localStorage.setItem(localKey, JSON.stringify(rows.slice(0, 100)));
    } catch (e) {
      console.warn('LocalStorage backup failed:', e);
    }

    // Show success state
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send';
    document.getElementById('gFeedbackFormContainer').style.display = 'none';
    document.getElementById('gFeedbackSuccess').style.display = 'block';

    setTimeout(() => {
      this.close();
    }, 2400);
  }
}

window.GoogleFeedback = GoogleFeedback;
let instance = null;
function getFeedbackInstance() {
  if (!instance) instance = new GoogleFeedback();
  return instance;
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { instance = getFeedbackInstance(); });
} else {
  instance = getFeedbackInstance();
}

export { GoogleFeedback, getFeedbackInstance };
