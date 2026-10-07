/**
 * General Assessment Response Viewer - Core Application Logic
 * Mobile-first, responsive, zero-external-dependency evaluation system.
 * 
 * Spec-Compliant Architecture:
 * 1. General Assessment & Technical Assessment strictly separated
 * 2. Voting system completely removed
 * 3. Candidate Classification (Good Candidate | Has Potential | Rejected) placed ABOVE candidate name
 * 4. Each General Assessment answer has its own independent evaluation:
 *    - Opinion: [ AGREE ] / [ DISAGREE ]
 *    - Rating: 1–5 Interactive Stars
 *    - Evaluator Ratings Roster (Who evaluated this answer)
 *    - Answer Evaluation Summary (Avg Rating, Counts, Distribution)
 * 5. General Assessment Score: 0 to 100 ((Average Rating / 5) * 100) with visual score bar
 * 6. Candidate Score Overview: Two separate score cards (General vs Technical)
 * 7. Candidate Report, Individual Evaluator Reports, and Master Overview Dashboard
 */

(function () {
  'use strict';

  // Application State
  const state = {
    dataset: null,
    respondents: [],
    questions: [],
    selectedRespondentId: null,
    activeAssessmentType: 'general', // 'general' | 'technical'
    showEvaluationGlobal: false,
    candidateEvaluation: null,
    expandedStatusAccordions: {
      good: false,
      potential: false,
      rejected: false
    },
    pollingTimer: null
  };

  const STAR_DESCRIPTIONS = {
    0: 'Select Rating',
    1: '★ 1/5 - Unsatisfactory',
    2: '★ 2/5 - Fair',
    3: '★ 3/5 - Competent',
    4: '★ 4/5 - Very Good',
    5: '★ 5/5 - Exceptional'
  };

  // DOM Elements cache
  let dom = {};

  async function init() {
    cacheDomElements();
    attachEventListeners();
    initParticipantIdentity();
    await loadData();
    startRealtimePolling();
  }

  function cacheDomElements() {
    dom = {
      // Sidebar desktop
      desktopSidebar: document.getElementById('desktopSidebar'),
      desktopSearchInput: document.getElementById('desktopSearchInput'),
      desktopSearchClear: document.getElementById('desktopSearchClear'),
      desktopFilterTabs: document.getElementById('desktopFilterTabs'),
      desktopRespondentList: document.getElementById('desktopRespondentList'),
      desktopIdentityBtn: document.getElementById('desktopIdentityBtn'),
      desktopIdentityName: document.getElementById('desktopIdentityName'),
      desktopIdentityAction: document.getElementById('desktopIdentityAction'),
      desktopOverviewBtn: document.getElementById('desktopOverviewBtn'),
      tabGeneralDesktop: document.getElementById('tabGeneralDesktop'),
      tabTechnicalDesktop: document.getElementById('tabTechnicalDesktop'),
      sidebarActiveViewBadge: document.getElementById('sidebarActiveViewBadge'),

      // Mobile header & drawer
      mobileHeader: document.getElementById('mobileHeader'),
      mobileHeaderTitle: document.getElementById('mobileHeaderTitle'),
      mobileHeaderSub: document.getElementById('mobileHeaderSub'),
      mobileSelectTrigger: document.getElementById('mobileSelectTrigger'),
      mobileSelectedNameBadge: document.getElementById('mobileSelectedNameBadge'),
      mobileIdentityBtn: document.getElementById('mobileIdentityBtn'),
      mobileIdentityName: document.getElementById('mobileIdentityName'),
      modalBackdrop: document.getElementById('modalBackdrop'),
      mobileDrawer: document.getElementById('mobileDrawer'),
      mobileDrawerClose: document.getElementById('mobileDrawerClose'),
      mobileSearchInput: document.getElementById('mobileSearchInput'),
      mobileSearchClear: document.getElementById('mobileSearchClear'),
      mobileFilterTabs: document.getElementById('mobileFilterTabs'),
      mobileRespondentList: document.getElementById('mobileRespondentList'),
      tabGeneralMobile: document.getElementById('tabGeneralMobile'),
      tabTechnicalMobile: document.getElementById('tabTechnicalMobile'),

      // Main view sections
      mainContentArea: document.getElementById('mainContentArea'),
      prevRespondentBtn: document.getElementById('prevRespondentBtn'),
      nextRespondentBtn: document.getElementById('nextRespondentBtn'),
      respondentCounter: document.getElementById('respondentCounter'),
      actionOverviewBtn: document.getElementById('actionOverviewBtn'),
      toggleEvaluationBtn: document.getElementById('toggleEvaluationBtn'),

      // Containers
      generalAssessmentView: document.getElementById('generalAssessmentView'),
      technicalAssessmentView: document.getElementById('technicalAssessmentView'),
      candidateStatusAboveContainer: document.getElementById('candidateStatusAboveContainer'),
      profileCardContainer: document.getElementById('profileCardContainer'),
      scoreOverviewContainer: document.getElementById('scoreOverviewContainer'),
      reportActionsContainer: document.getElementById('reportActionsContainer'),
      questionJumpContainer: document.getElementById('questionJumpContainer'),
      questionCardsContainer: document.getElementById('questionCardsContainer'),

      // Modals
      identityModal: document.getElementById('identityModal'),
      identityForm: document.getElementById('identityForm'),
      identityInputName: document.getElementById('identityInputName'),
      identityInputId: document.getElementById('identityInputId'),
      identitySubmitBtn: document.getElementById('identitySubmitBtn'),

      overviewModal: document.getElementById('overviewModal'),
      overviewModalClose: document.getElementById('overviewModalClose'),
      overviewModalBody: document.getElementById('overviewModalBody'),

      candidateReportModal: document.getElementById('candidateReportModal'),
      candidateReportModalClose: document.getElementById('candidateReportModalClose'),
      candidateReportModalBody: document.getElementById('candidateReportModalBody'),

      evaluatorReportModal: document.getElementById('evaluatorReportModal'),
      evaluatorReportModalClose: document.getElementById('evaluatorReportModalClose'),
      evaluatorReportModalBody: document.getElementById('evaluatorReportModalBody'),

      // Toast
      toastMessage: document.getElementById('toastMessage')
    };
  }

  async function initParticipantIdentity() {
    let p = window.AssessmentEvaluation.loadStoredParticipant();
    if (p && typeof window.AssessmentEvaluation.validateStoredParticipant === 'function') {
      p = await window.AssessmentEvaluation.validateStoredParticipant();
    }
    updateIdentityUI(p);

    if (!p) {
      setTimeout(() => {
        openIdentityModal();
      }, 400);
    }
  }

  function updateIdentityUI(p) {
    if (p && p.name) {
      if (dom.desktopIdentityName) dom.desktopIdentityName.textContent = p.name;
      if (dom.desktopIdentityAction) dom.desktopIdentityAction.textContent = 'Change';
      if (dom.mobileIdentityName) dom.mobileIdentityName.textContent = p.name.split(' ')[0];
    } else {
      if (dom.desktopIdentityName) dom.desktopIdentityName.textContent = 'Identify Yourself';
      if (dom.desktopIdentityAction) dom.desktopIdentityAction.textContent = 'Sign In';
      if (dom.mobileIdentityName) dom.mobileIdentityName.textContent = 'Sign In';
    }
  }

  function openIdentityModal() {
    const p = window.AssessmentEvaluation.getParticipant();
    if (p) {
      if (dom.identityInputName) dom.identityInputName.value = p.name || '';
      if (dom.identityInputId) dom.identityInputId.value = p.student_id || '';
    }
    if (dom.identityModal) dom.identityModal.classList.add('open');
    if (dom.identityInputName) dom.identityInputName.focus();
  }

  function closeIdentityModal() {
    if (dom.identityModal) dom.identityModal.classList.remove('open');
  }

  async function handleIdentitySubmit(e) {
    if (e) e.preventDefault();
    const name = dom.identityInputName ? dom.identityInputName.value.trim() : '';
    const studentId = dom.identityInputId ? dom.identityInputId.value.trim() : '';

    if (!name) {
      showToast('Please enter your full name');
      return;
    }

    if (dom.identitySubmitBtn) {
      dom.identitySubmitBtn.disabled = true;
      dom.identitySubmitBtn.textContent = 'Registering...';
    }

    try {
      const res = await window.AssessmentEvaluation.registerParticipant(name, studentId);
      updateIdentityUI(res.participant);
      closeIdentityModal();
      showToast(`Welcome, ${res.participant.name}!`);

      if (state.selectedRespondentId) {
        await refreshCandidateEvaluation(state.selectedRespondentId, false);
      }
    } catch (err) {
      showToast(err.message || 'Error saving identity');
    } finally {
      if (dom.identitySubmitBtn) {
        dom.identitySubmitBtn.disabled = false;
        dom.identitySubmitBtn.textContent = 'Continue to General Assessment';
      }
    }
  }

  /**
   * Load Assessment Dataset from JSON or bundled JS fallback
   */
  async function loadData() {
    try {
      let data = null;
      try {
        const response = await fetch('data/assessment.json');
        if (response.ok) {
          data = await response.json();
        }
      } catch (netErr) {
        console.info('Fetch error, checking bundled dataset fallback.');
      }

      if (!data && window.ASSESSMENT_DATA) {
        data = window.ASSESSMENT_DATA;
      }

      if (!data || !data.respondents || data.respondents.length === 0) {
        throw new Error('Assessment data could not be loaded.');
      }

      state.dataset = data;
      state.respondents = data.respondents;
      state.questions = data.questions;

      if (window.AssessmentSearch && typeof window.AssessmentSearch.init === 'function') {
        window.AssessmentSearch.init(state.respondents, () => {
          renderSidebarList('desktop');
          renderSidebarList('mobile');
        });
      }

      renderSidebarList('desktop');
      renderSidebarList('mobile');

      // Select initial candidate
      const targetId = getRespondentIdFromUrl() || state.respondents[0].id;
      selectRespondent(targetId, false);

    } catch (err) {
      console.error(err);
      showCriticalError('Failed to load assessment data: ' + err.message);
    }
  }

  function attachEventListeners() {
    // Identity triggers
    if (dom.desktopIdentityBtn) dom.desktopIdentityBtn.addEventListener('click', openIdentityModal);
    if (dom.mobileIdentityBtn) dom.mobileIdentityBtn.addEventListener('click', openIdentityModal);
    if (dom.identityForm) dom.identityForm.addEventListener('submit', handleIdentitySubmit);

    // Overview Dashboard
    if (dom.desktopOverviewBtn) dom.desktopOverviewBtn.addEventListener('click', openOverviewModal);
    if (dom.actionOverviewBtn) dom.actionOverviewBtn.addEventListener('click', openOverviewModal);
    if (dom.overviewModalClose) dom.overviewModalClose.addEventListener('click', closeOverviewModal);

    // Modals close on backdrop click
    [dom.identityModal, dom.overviewModal, dom.candidateReportModal, dom.evaluatorReportModal].forEach(m => {
      if (!m) return;
      m.addEventListener('click', (e) => {
        if (e.target === m) m.classList.remove('open');
      });
    });

    if (dom.candidateReportModalClose) dom.candidateReportModalClose.addEventListener('click', () => {
      if (dom.candidateReportModal) dom.candidateReportModal.classList.remove('open');
    });

    if (dom.evaluatorReportModalClose) dom.evaluatorReportModalClose.addEventListener('click', () => {
      if (dom.evaluatorReportModal) dom.evaluatorReportModal.classList.remove('open');
    });

    // Assessment Type Switchers
    if (dom.tabGeneralDesktop) dom.tabGeneralDesktop.addEventListener('click', () => switchAssessmentType('general'));
    if (dom.tabTechnicalDesktop) dom.tabTechnicalDesktop.addEventListener('click', () => switchAssessmentType('technical'));
    if (dom.tabGeneralMobile) dom.tabGeneralMobile.addEventListener('click', () => switchAssessmentType('general'));
    if (dom.tabTechnicalMobile) dom.tabTechnicalMobile.addEventListener('click', () => switchAssessmentType('technical'));

    // Pagination
    if (dom.prevRespondentBtn) dom.prevRespondentBtn.addEventListener('click', () => navigateRespondent(-1));
    if (dom.nextRespondentBtn) dom.nextRespondentBtn.addEventListener('click', () => navigateRespondent(1));

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') navigateRespondent(-1);
      if (e.key === 'ArrowRight') navigateRespondent(1);
    });

    // Toggle original points/feedback
    if (dom.toggleEvaluationBtn) dom.toggleEvaluationBtn.addEventListener('click', toggleGlobalEvaluation);

    // Mobile drawer triggers
    if (dom.mobileSelectTrigger) dom.mobileSelectTrigger.addEventListener('click', openMobileDrawer);
    if (dom.mobileDrawerClose) dom.mobileDrawerClose.addEventListener('click', closeMobileDrawer);
    if (dom.modalBackdrop) dom.modalBackdrop.addEventListener('click', closeMobileDrawer);

    // Search inputs
    setupSearchInput(dom.desktopSearchInput, dom.desktopSearchClear);
    setupSearchInput(dom.mobileSearchInput, dom.mobileSearchClear);

    // Division Filter Tabs
    setupDivisionTabs(dom.desktopFilterTabs);
    setupDivisionTabs(dom.mobileFilterTabs);

    // Popstate
    window.addEventListener('popstate', () => {
      const id = getRespondentIdFromUrl();
      if (id && id !== state.selectedRespondentId) {
        selectRespondent(id, false);
      }
    });
  }

  function setupSearchInput(inputEl, clearBtn) {
    if (!inputEl) return;
    inputEl.addEventListener('input', (e) => {
      const q = e.target.value;
      window.AssessmentSearch.setQuery(q);
      renderSidebarList('desktop');
      renderSidebarList('mobile');
      if (clearBtn) clearBtn.classList.toggle('visible', q.length > 0);
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        inputEl.value = '';
        window.AssessmentSearch.setQuery('');
        renderSidebarList('desktop');
        renderSidebarList('mobile');
        clearBtn.classList.remove('visible');
        inputEl.focus();
      });
    }
  }

  function setupDivisionTabs(tabsContainer) {
    if (!tabsContainer) return;
    tabsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      const div = btn.getAttribute('data-division');
      window.AssessmentSearch.setDivision(div);

      [dom.desktopFilterTabs, dom.mobileFilterTabs].forEach(c => {
        if (!c) return;
        c.querySelectorAll('.filter-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-division') === div);
        });
      });

      renderSidebarList('desktop');
      renderSidebarList('mobile');
    });
  }

  /**
   * Switch between General Assessment and Technical Assessment (Section 15 & 17)
   */
  function switchAssessmentType(type) {
    state.activeAssessmentType = type;

    // Desktop tabs update
    if (dom.tabGeneralDesktop) dom.tabGeneralDesktop.classList.toggle('active', type === 'general');
    if (dom.tabTechnicalDesktop) dom.tabTechnicalDesktop.classList.toggle('active', type === 'technical');

    // Mobile tabs update
    if (dom.tabGeneralMobile) dom.tabGeneralMobile.classList.toggle('active', type === 'general');
    if (dom.tabTechnicalMobile) dom.tabTechnicalMobile.classList.toggle('active', type === 'technical');

    // Indicator update
    if (dom.sidebarActiveViewBadge) {
      dom.sidebarActiveViewBadge.innerHTML = type === 'general' ?
        `<span class="badge-dot" style="background:var(--accent-emerald)"></span><span>Active: <strong>General Assessment</strong></span>` :
        `<span class="badge-dot" style="background:var(--text-muted)"></span><span>Active: <strong>Technical Assessment</strong></span>`;
    }

    if (dom.mobileHeaderTitle) {
      dom.mobileHeaderTitle.textContent = type === 'general' ? 'GENERAL ASSESSMENT' : 'TECHNICAL ASSESSMENT';
    }
    if (dom.mobileHeaderSub) {
      dom.mobileHeaderSub.textContent = type === 'general' ? 'Evaluation Active' : 'Separate Assessment';
    }

    // Toggle views
    if (type === 'general') {
      if (dom.generalAssessmentView) dom.generalAssessmentView.style.display = 'block';
      if (dom.technicalAssessmentView) dom.technicalAssessmentView.style.display = 'none';
      if (state.selectedRespondentId) {
        refreshCandidateEvaluation(state.selectedRespondentId, false);
      }
    } else {
      if (dom.generalAssessmentView) dom.generalAssessmentView.style.display = 'none';
      if (dom.technicalAssessmentView) {
        dom.technicalAssessmentView.style.display = 'block';
        renderTechnicalAssessmentView();
      }
    }
  }

  function renderTechnicalAssessmentView() {
    if (!dom.technicalAssessmentView) return;
    const currentCand = state.respondents.find(r => r.id === state.selectedRespondentId);
    const candName = currentCand ? currentCand.name : 'Candidate';
    const candCode = currentCand ? `GA-${String(currentCand.id).padStart(3, '0')}` : '';

    dom.technicalAssessmentView.innerHTML = `
      <section class="technical-assessment-container" aria-label="Technical Assessment Notice">
        <div class="tech-icon-large">💻</div>
        <h2 class="tech-title-large">TECHNICAL ASSESSMENT</h2>
        <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:14px;">
          Candidate: <strong style="color:var(--text-primary)">${escapeHtml(candName)}</strong> (${candCode})
        </div>
        
        <div class="tech-score-card-standalone">
          <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em;">
            Technical Assessment Score
          </div>
          <div style="font-size:3rem; font-weight:800; font-family:var(--font-mono); color:var(--text-muted); margin:4px 0;">
            -- / 100
          </div>
          <div style="font-size:0.75rem; color:var(--text-muted);">Separate assessment · Independent workflow</div>
        </div>

        <p class="tech-desc-text">
          As mandated by the evaluation policy, <strong>General Assessment</strong> and <strong>Technical Assessment</strong> are treated as two completely separate assessment tracks.
          <br><br>
          The answer-level agreement, 1–5 star ratings, and candidate classification systems apply exclusively to General Assessment. Technical Assessment evaluation will be conducted independently.
        </p>

        <button type="button" class="identity-submit-btn" id="btnReturnToGeneral" style="max-width:280px; margin:0 auto;">
          ← Switch to General Assessment
        </button>
      </section>
    `;

    const btnReturn = document.getElementById('btnReturnToGeneral');
    if (btnReturn) {
      btnReturn.addEventListener('click', () => switchAssessmentType('general'));
    }
  }

  function openMobileDrawer() {
    if (dom.modalBackdrop) dom.modalBackdrop.classList.add('open');
    if (dom.mobileDrawer) dom.mobileDrawer.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (dom.mobileSearchInput) dom.mobileSearchInput.focus();
  }

  function closeMobileDrawer() {
    if (dom.modalBackdrop) dom.modalBackdrop.classList.remove('open');
    if (dom.mobileDrawer) dom.mobileDrawer.classList.remove('open');
    document.body.style.overflow = '';
  }

  function renderSidebarList(target) {
    const listEl = target === 'desktop' ? dom.desktopRespondentList : dom.mobileRespondentList;
    if (!listEl) return;

    const filtered = window.AssessmentSearch.filterRespondents(
      state.respondents,
      window.AssessmentSearch.getCurrentQuery(),
      window.AssessmentSearch.getActiveDivision()
    );

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="empty-search-state">
          <div>No candidates match criteria</div>
          <div style="font-size:0.75rem; margin-top:4px; opacity:0.7;">Try another search term or clear filters</div>
        </div>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();

    filtered.forEach((r) => {
      const itemBtn = document.createElement('button');
      itemBtn.type = 'button';
      itemBtn.className = `respondent-item ${r.id === state.selectedRespondentId ? 'active' : ''}`;
      itemBtn.setAttribute('data-id', r.id);
      itemBtn.setAttribute('aria-label', `Select ${r.name}, GA-${String(r.id).padStart(3, '0')}`);

      const hasBlanks = r.unanswered_count > 0;
      const statusTitle = hasBlanks ? `${r.answered_count}/${r.total_questions} answered (${r.unanswered_count} blank)` : 'All 28 answered';
      const candCode = `GA-${String(r.id).padStart(3, '0')}`;

      itemBtn.innerHTML = `
        <div class="resp-item-info">
          <div class="resp-item-id-name">
            <span class="resp-id-badge">${candCode}</span>
            <span class="resp-name" title="${escapeHtml(r.name)}">${escapeHtml(r.name)}</span>
          </div>
          <div class="resp-item-meta">
            <span class="resp-div-pill div-${r.division}">Div ${escapeHtml(r.division)}</span>
            <span>${r.answered_count}/${r.total_questions} Qs</span>
          </div>
        </div>
        <div class="resp-status-dot ${hasBlanks ? 'has-blanks' : ''}" title="${statusTitle}"></div>
      `;

      itemBtn.addEventListener('click', () => {
        selectRespondent(r.id, true);
        if (target === 'mobile') closeMobileDrawer();
      });

      fragment.appendChild(itemBtn);
    });

    listEl.innerHTML = '';
    listEl.appendChild(fragment);
  }

  async function selectRespondent(id, updateUrl = true) {
    const respondent = state.respondents.find((r) => r.id === id);
    if (!respondent) return;

    state.selectedRespondentId = id;

    if (updateUrl) {
      updateUrlWithRespondentId(id);
    }

    updateActiveSidebarItems(id);
    updateNavigationControls();

    if (state.activeAssessmentType === 'technical') {
      renderTechnicalAssessmentView();
    } else {
      // 1. Render Candidate Profile Header
      renderProfileHeader(respondent);

      // 2. Fetch and render candidate evaluation (Candidate Status above name, Score cards, Answers)
      await refreshCandidateEvaluation(respondent.id, true);

      // 3. Render Quick Jump Bar
      renderQuickJumpBar(respondent);

      // 4. Render Questions with answer-level opinion & 1-5 star ratings
      renderQuestionCards(respondent);
    }

    if (dom.mobileSelectedNameBadge) {
      const code = `GA-${String(respondent.id).padStart(3, '0')}`;
      dom.mobileSelectedNameBadge.textContent = `${respondent.name} (${code})`;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateActiveSidebarItems(selectedId) {
    [dom.desktopRespondentList, dom.mobileRespondentList].forEach((container) => {
      if (!container) return;
      const items = container.querySelectorAll('.respondent-item');
      items.forEach((item) => {
        const itemId = parseInt(item.getAttribute('data-id'), 10);
        item.classList.toggle('active', itemId === selectedId);
      });
    });
  }

  function updateNavigationControls() {
    const currentIndex = state.respondents.findIndex((r) => r.id === state.selectedRespondentId);
    const total = state.respondents.length;

    if (dom.prevRespondentBtn) dom.prevRespondentBtn.disabled = currentIndex <= 0;
    if (dom.nextRespondentBtn) dom.nextRespondentBtn.disabled = currentIndex >= total - 1;
    if (dom.respondentCounter) dom.respondentCounter.textContent = `Candidate ${currentIndex + 1} of ${total}`;
  }

  function navigateRespondent(direction) {
    const currentIndex = state.respondents.findIndex((r) => r.id === state.selectedRespondentId);
    const newIndex = currentIndex + direction;

    if (newIndex >= 0 && newIndex < state.respondents.length) {
      const nextRespondent = state.respondents[newIndex];
      selectRespondent(nextRespondent.id, true);
    }
  }

  /**
   * Render Candidate Profile Header Card (Candidate Name, Candidate ID e.g. GA-024)
   */
  function renderProfileHeader(respondent) {
    if (!dom.profileCardContainer) return;

    const candCode = `GA-${String(respondent.id).padStart(3, '0')}`;
    const isComplete = respondent.unanswered_count === 0;

    dom.profileCardContainer.innerHTML = `
      <section class="profile-card" aria-label="Candidate Information">
        <div class="profile-header-top">
          <div class="profile-title-area">
            <div class="profile-badge-row">
              <span class="profile-context-label">General Assessment Candidate</span>
              <span class="resp-div-pill div-${respondent.division}">Division ${escapeHtml(respondent.division)}</span>
            </div>
            <h1 class="profile-name">${escapeHtml(respondent.name)}</h1>
          </div>
          <button type="button" class="profile-share-btn" id="shareProfileBtn" title="Copy shareable link to this candidate">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
              <polyline points="16 6 12 2 8 6"></polyline>
              <line x1="12" y1="2" x2="12" y2="15"></line>
            </svg>
            <span>Share Link</span>
          </button>
        </div>

        <div class="profile-stats-grid">
          <div class="stat-box">
            <div class="stat-label">Candidate ID</div>
            <div class="stat-value font-mono">${candCode}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Questions Answered</div>
            <div class="stat-value ${isComplete ? 'font-mono' : 'text-amber font-mono'}">
              ${respondent.answered_count} / ${respondent.total_questions}
            </div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Assessment Status</div>
            <div class="stat-value">
              <span class="status-pill ${isComplete ? 'complete' : 'incomplete'}">
                ${isComplete ? 'All Answered' : `${respondent.unanswered_count} Blank`}
              </span>
            </div>
          </div>
        </div>
      </section>
    `;

    const shareBtn = document.getElementById('shareProfileBtn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        copyTextToClipboard(window.location.href, () => {
          showToast(`Link for ${respondent.name} copied to clipboard!`);
        });
      });
    }
  }

  /**
   * Fetch candidate evaluation and render:
   * 1. Candidate Status (ABOVE name)
   * 2. Score Overview Cards (General vs Technical)
   * 3. Report action buttons
   */
  async function refreshCandidateEvaluation(candidateId, reRenderQuestions = false) {
    try {
      const data = await window.AssessmentEvaluation.fetchCandidate(candidateId);
      state.candidateEvaluation = data;

      renderCandidateStatusAbove(data);
      renderScoreOverviewCards(data);
      renderReportActionsToolbar(data);

      if (reRenderQuestions) {
        const respondent = state.respondents.find(r => r.id === candidateId);
        if (respondent) renderQuestionCards(respondent);
      } else {
        updateAnswerCardsState(data);
      }
    } catch (e) {
      console.warn('Evaluation fetch error:', e);
    }
  }

  /**
   * Render Candidate Classification ABOVE Candidate Name (Section 3)
   */
  function renderCandidateStatusAbove(evalData) {
    if (!dom.candidateStatusAboveContainer) return;

    const cls = evalData.classifications || {};
    const myCls = cls.my_classification;

    let myStatusText = 'No classification submitted yet';
    if (myCls === 'good_candidate') myStatusText = 'Your Decision: GOOD CANDIDATE 🌟';
    else if (myCls === 'has_potential') myStatusText = 'Your Decision: HAS POTENTIAL ⏳';
    else if (myCls === 'rejected') myStatusText = 'Your Decision: REJECTED ❌';

    const renderTags = (voters) => {
      if (!voters || voters.length === 0) return '<span style="color:var(--text-muted); font-size:0.72rem;">None yet</span>';
      return voters.map(v => `<span class="evaluator-tag">${escapeHtml(v.name)}${v.student_id ? ` (${escapeHtml(v.student_id)})` : ''}</span>`).join('');
    };

    dom.candidateStatusAboveContainer.innerHTML = `
      <section class="candidate-status-above-box" aria-label="Candidate Classification">
        <div class="status-box-header">
          <div class="status-box-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
            </svg>
            <span>CANDIDATE STATUS</span>
          </div>
          <span class="status-current-badge">${myStatusText}</span>
        </div>

        <div class="status-buttons-grid">
          <button type="button" class="status-btn btn-good ${myCls === 'good_candidate' ? 'selected' : ''}" data-cls="good_candidate">
            <span>GOOD CANDIDATE</span>
            <span class="status-btn-sub">Suitable for selection</span>
          </button>
          <button type="button" class="status-btn btn-potential ${myCls === 'has_potential' ? 'selected' : ''}" data-cls="has_potential">
            <span>HAS POTENTIAL</span>
            <span class="status-btn-sub">Requires consideration</span>
          </button>
          <button type="button" class="status-btn btn-rejected ${myCls === 'rejected' ? 'selected' : ''}" data-cls="rejected">
            <span>REJECTED</span>
            <span class="status-btn-sub">Not suitable</span>
          </button>
        </div>

        <!-- Live Aggregated Breakdown & Accordion (Section 21 & 22) -->
        <div class="status-aggregation-bar">
          <div class="status-stat-pills-row">
            <div class="status-pill-item" data-target="drawerGood">
              <span class="status-pill-dot good"></span>
              <span>Good Candidate: <strong>${cls.good_count || 0}</strong> (${cls.good_percentage || 0}%) ▾</span>
            </div>
            <div class="status-pill-item" data-target="drawerPotential">
              <span class="status-pill-dot potential"></span>
              <span>Has Potential: <strong>${cls.potential_count || 0}</strong> (${cls.potential_percentage || 0}%) ▾</span>
            </div>
            <div class="status-pill-item" data-target="drawerRejected">
              <span class="status-pill-dot rejected"></span>
              <span>Rejected: <strong>${cls.rejected_count || 0}</strong> (${cls.rejected_percentage || 0}%) ▾</span>
            </div>
          </div>

          <div class="status-accordion-drawer ${state.expandedStatusAccordions.good ? 'open' : ''}" id="drawerGood">
            <div style="font-size:0.72rem; color:var(--text-muted); margin-bottom:4px;">Evaluators selecting Good Candidate (${cls.good_count || 0}):</div>
            <div class="evaluator-tags-flex">${renderTags(cls.good_voters)}</div>
          </div>
          <div class="status-accordion-drawer ${state.expandedStatusAccordions.potential ? 'open' : ''}" id="drawerPotential">
            <div style="font-size:0.72rem; color:var(--text-muted); margin-bottom:4px;">Evaluators selecting Has Potential (${cls.potential_count || 0}):</div>
            <div class="evaluator-tags-flex">${renderTags(cls.potential_voters)}</div>
          </div>
          <div class="status-accordion-drawer ${state.expandedStatusAccordions.rejected ? 'open' : ''}" id="drawerRejected">
            <div style="font-size:0.72rem; color:var(--text-muted); margin-bottom:4px;">Evaluators selecting Rejected (${cls.rejected_count || 0}):</div>
            <div class="evaluator-tags-flex">${renderTags(cls.rejected_voters)}</div>
          </div>
        </div>
      </section>
    `;

    // Attach classification click events
    const clsButtons = dom.candidateStatusAboveContainer.querySelectorAll('.status-btn');
    clsButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const p = window.AssessmentEvaluation.getParticipant();
        if (!p) {
          openIdentityModal();
          return;
        }

        const targetCls = btn.getAttribute('data-cls');
        const newCls = myCls === targetCls ? null : targetCls; // toggle or set

        try {
          const res = await window.AssessmentEvaluation.classifyCandidate(state.selectedRespondentId, newCls);
          showToast(newCls ? `Candidate classified as ${targetCls.replace('_', ' ').toUpperCase()}` : 'Classification cleared');
          state.candidateEvaluation = res.candidate_data;
          renderCandidateStatusAbove(res.candidate_data);
          renderScoreOverviewCards(res.candidate_data);
        } catch (err) {
          showToast(err.message || 'Error updating classification');
        }
      });
    });

    // Attach accordion toggles
    const pillItems = dom.candidateStatusAboveContainer.querySelectorAll('.status-pill-item');
    pillItems.forEach(item => {
      item.addEventListener('click', () => {
        const targetId = item.getAttribute('data-target');
        const drawer = document.getElementById(targetId);
        if (drawer) {
          const isOpen = drawer.classList.contains('open');
          drawer.classList.toggle('open', !isOpen);
          if (targetId === 'drawerGood') state.expandedStatusAccordions.good = !isOpen;
          if (targetId === 'drawerPotential') state.expandedStatusAccordions.potential = !isOpen;
          if (targetId === 'drawerRejected') state.expandedStatusAccordions.rejected = !isOpen;
        }
      });
    });
  }

  /**
   * Render Assessment Score Overview Cards (Section 16: General vs Technical)
   */
  function renderScoreOverviewCards(evalData) {
    if (!dom.scoreOverviewContainer) return;

    const so = evalData.score_overview || {};
    const ga = so.general_assessment || {};
    const pe = so.personal_evaluation || {};

    const gaScoreText = ga.score !== null ? `${ga.score}` : '--';
    const gaScorePercent = ga.score !== null ? Math.min(Math.max(ga.score, 0), 100) : 0;
    const gaSubtext = ga.average_rating !== null ?
      `Based on answer ratings (Average: ${ga.average_rating} / 5 from ${ga.total_ratings} ratings)` :
      `No answer ratings recorded yet for this candidate`;

    let personalBadgeHtml = '';
    if (pe.answers_evaluated > 0) {
      personalBadgeHtml = `
        <div class="personal-eval-pill">
          <span>👤 <strong>Your Evaluation:</strong> ${pe.answers_evaluated} of ${ga.total_questions || 28} evaluated</span>
          <span>•</span>
          <span>Avg: <strong>${pe.avg_rating !== null ? pe.avg_rating : '--'}/5</strong></span>
          <span>•</span>
          <span>Score: <strong>${pe.score !== null ? pe.score : '--'}%</strong></span>
        </div>
      `;
    }

    dom.scoreOverviewContainer.innerHTML = `
      <div class="score-overview-grid" aria-label="Assessment Score Overview">
        <!-- 1. GENERAL ASSESSMENT SCORE CARD -->
        <div class="assessment-score-card general-card">
          <div class="score-card-header">
            <span class="score-card-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              GENERAL ASSESSMENT
            </span>
            <span class="score-card-badge live">EVALUATION ACTIVE</span>
          </div>

          <div class="score-display-row">
            <span class="score-number">${gaScoreText}</span>
            <span class="score-denom">/ 100</span>
          </div>

          <!-- 0-100 Visual Score Bar (Section 14) -->
          <div class="score-bar-container">
            <div class="score-bar-track" title="General Assessment Score: ${gaScoreText} / 100">
              <div class="score-bar-fill" style="width: ${gaScorePercent}%"></div>
            </div>
            <div class="score-bar-ticks">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>

          <div class="score-card-subtext">${gaSubtext}</div>
          ${personalBadgeHtml}
        </div>

        <!-- 2. TECHNICAL ASSESSMENT SCORE CARD (Section 16) -->
        <div class="assessment-score-card technical-card">
          <div class="score-card-header">
            <span class="score-card-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              TECHNICAL ASSESSMENT
            </span>
            <span class="score-card-badge sep">SEPARATE</span>
          </div>

          <div class="score-display-row">
            <span class="score-number dim">--</span>
            <span class="score-denom">/ 100</span>
          </div>

          <div class="score-bar-container" style="opacity:0.35;">
            <div class="score-bar-track">
              <div class="score-bar-fill" style="width: 0%;"></div>
            </div>
            <div class="score-bar-ticks">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>

          <div class="score-card-subtext">Separate assessment · Evaluated on independent track</div>
        </div>
      </div>
    `;
  }

  function renderReportActionsToolbar(evalData) {
    if (!dom.reportActionsContainer) return;

    dom.reportActionsContainer.innerHTML = `
      <div class="report-actions-toolbar">
        <button type="button" class="report-action-btn" id="btnOpenCandidateReport">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          <span>Candidate GA Report</span>
        </button>

        <button type="button" class="report-action-btn" id="btnOpenEvaluatorReports">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span>Individual Evaluator Reports</span>
        </button>
      </div>
    `;

    const btnCandReport = document.getElementById('btnOpenCandidateReport');
    if (btnCandReport) {
      btnCandReport.addEventListener('click', () => openCandidateReportModal(evalData));
    }

    const btnEvReport = document.getElementById('btnOpenEvaluatorReports');
    if (btnEvReport) {
      btnEvReport.addEventListener('click', () => openEvaluatorReportModal(evalData));
    }
  }

  /**
   * Render Question & Answer Cards with Individual Answer Evaluation (Section 4–8)
   */
  function renderQuestionCards(respondent) {
    if (!dom.questionCardsContainer) return;

    const answersData = (state.candidateEvaluation && state.candidateEvaluation.answers) || {};
    let html = '';
    let currentSection = null;

    respondent.responses.forEach((resp) => {
      if (resp.section_id !== currentSection) {
        currentSection = resp.section_id;
        const isSecA = currentSection === 'A';
        html += `
          <div class="section-divider ${isSecA ? 'section-a' : 'section-b'}">
            <div class="section-divider-title">${resp.section_title}</div>
            <div class="section-divider-count">${isSecA ? 'Questions 01 – 12' : 'Questions 13 – 28'}</div>
          </div>
        `;
      }

      const qNum = resp.question_number;
      const qNumFormatted = String(qNum).padStart(2, '0');
      const isAnswered = resp.is_answered;
      const rawAnswer = resp.answer;

      const ansEval = answersData[qNum] || {
        avg_rating: null,
        total_ratings: 0,
        agree_count: 0,
        disagree_count: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        evaluators: [],
        my_evaluation: { opinion: null, rating: null }
      };

      const myOpinion = ansEval.my_evaluation ? ansEval.my_evaluation.opinion : null;
      const myRating = ansEval.my_evaluation ? ansEval.my_evaluation.rating : null;

      // Evaluator Roster HTML
      let rosterItemsHtml = '';
      if (ansEval.evaluators && ansEval.evaluators.length > 0) {
        ansEval.evaluators.forEach(ev => {
          let opPill = '';
          if (ev.opinion === 'agree') opPill = '<span class="roster-opinion-pill agree">Agree</span>';
          else if (ev.opinion === 'disagree') opPill = '<span class="roster-opinion-pill disagree">Disagree</span>';

          const starsStr = ev.rating ? '★'.repeat(ev.rating) + '☆'.repeat(5 - ev.rating) : 'Unrated';

          rosterItemsHtml += `
            <div class="evaluator-roster-item">
              <span class="roster-evaluator-name">${escapeHtml(ev.name)}${ev.student_id ? ` <span style="color:var(--text-muted); font-size:0.7rem;">(${escapeHtml(ev.student_id)})</span>` : ''}</span>
              <div class="roster-evaluator-values">
                ${opPill}
                <span class="roster-stars-text" title="${ev.rating ? `${ev.rating}/5 stars` : 'No star rating'}">${starsStr}</span>
              </div>
            </div>
          `;
        });
      } else {
        rosterItemsHtml = '<div style="font-size:0.75rem; color:var(--text-muted); padding:4px 0;">No evaluator reviews submitted yet for this answer.</div>';
      }

      // Summary distribution histogram HTML
      let histBarsHtml = '';
      [5, 4, 3, 2, 1].forEach(star => {
        const cnt = (ansEval.distribution && ansEval.distribution[star]) || 0;
        const pct = ansEval.total_ratings > 0 ? (cnt / ansEval.total_ratings) * 100 : 0;
        histBarsHtml += `
          <div class="ans-hist-row">
            <span>${star}★</span>
            <div class="ans-hist-bar">
              <div class="ans-hist-fill" style="width: ${pct}%"></div>
            </div>
            <span>${cnt}</span>
          </div>
        `;
      });

      const avgText = ansEval.avg_rating !== null ? `★ ${ansEval.avg_rating} / 5` : 'Not rated';

      html += `
        <article class="question-card" id="q-card-${qNum}" aria-labelledby="q-title-${qNum}">
          <header class="q-card-header">
            <div class="q-meta-left">
              <span class="q-number-pill">QUESTION ${qNumFormatted}</span>
              <span class="q-section-tag">${escapeHtml(resp.section_title.split(':')[0])}</span>
            </div>
            ${isAnswered ? `
              <button type="button" class="copy-answer-btn" data-qnum="${qNum}" title="Copy raw answer to clipboard">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span class="copy-btn-text">Copy</span>
              </button>
            ` : ''}
          </header>

          <h2 class="question-prompt" id="q-title-${qNum}">${escapeHtml(resp.question)}</h2>

          <div class="answer-box">
            <div class="answer-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Candidate Answer</span>
            </div>
            ${isAnswered ? `
              <div class="answer-text" id="answer-content-${qNum}">${escapeHtml(rawAnswer)}</div>
            ` : `
              <div class="answer-text empty-response">No response recorded</div>
            `}
          </div>

          <!-- Original Points / Feedback (Collapsible) -->
          <div class="eval-details-box">
            <div class="eval-summary-toggle ${state.showEvaluationGlobal ? 'open' : ''}" data-qnum="${qNum}" role="button" tabindex="0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
              <span>Original Points & Feedback</span>
            </div>
            <div class="eval-content ${state.showEvaluationGlobal ? 'open' : ''}" id="eval-content-${qNum}">
              <div class="eval-row">
                <span class="eval-field-title">Points:</span>
                <span class="eval-field-val">${resp.points !== null && resp.points !== '' ? escapeHtml(resp.points) : 'None recorded'}</span>
              </div>
              <div class="eval-row">
                <span class="eval-field-title">Feedback:</span>
                <span class="eval-field-val">${resp.feedback !== null && resp.feedback !== '' ? escapeHtml(resp.feedback) : 'None recorded'}</span>
              </div>
            </div>
          </div>

          <!-- INDIVIDUAL ANSWER EVALUATION SECTION (Section 4–8) -->
          <div class="answer-evaluation-section" id="ans-eval-section-${qNum}">
            <div class="answer-eval-header">
              <span class="answer-eval-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
                EVALUATION FOR THIS ANSWER
              </span>
              <span class="answer-save-badge" id="save-badge-${qNum}">✓ Saved</span>
            </div>

            <!-- Opinion & Rating Controls Grid -->
            <div class="eval-controls-grid">
              
              <!-- 1. Opinion: Agree / Disagree (Section 4 & 5) -->
              <div class="eval-control-group">
                <div class="eval-control-label">Your Opinion On This Answer</div>
                <div class="opinion-choice-buttons">
                  <button type="button" 
                          class="btn-opinion-choice btn-agree ${myOpinion === 'agree' ? 'selected' : ''}" 
                          data-qnum="${qNum}" 
                          data-opinion="agree">
                    <span>AGREE 👍</span>
                  </button>
                  <button type="button" 
                          class="btn-opinion-choice btn-disagree ${myOpinion === 'disagree' ? 'selected' : ''}" 
                          data-qnum="${qNum}" 
                          data-opinion="disagree">
                    <span>DISAGREE 👎</span>
                  </button>
                </div>
              </div>

              <!-- 2. Rating: 1-5 Interactive Stars (Section 4 & 6) -->
              <div class="eval-control-group">
                <div class="eval-control-label">Your Rating</div>
                <div class="answer-star-wrapper">
                  <div class="interactive-answer-stars" id="stars-group-${qNum}" data-qnum="${qNum}">
                    ${[1, 2, 3, 4, 5].map(s => `
                      <span class="answer-star-btn ${myRating && s <= myRating ? 'active' : ''}" 
                            data-star="${s}" 
                            data-qnum="${qNum}" 
                            role="button" 
                            tabindex="0" 
                            title="${STAR_DESCRIPTIONS[s]}">★</span>
                    `).join('')}
                  </div>
                  <span class="answer-star-feedback" id="star-feedback-${qNum}">
                    ${myRating ? STAR_DESCRIPTIONS[myRating] : 'Select Rating'}
                  </span>
                </div>
              </div>

            </div>

            <!-- Evaluator Ratings Roster (Section 7) -->
            <div class="evaluator-ratings-roster-box">
              <div class="evaluator-roster-title">
                Evaluator Ratings (${ansEval.evaluators ? ansEval.evaluators.length : 0})
              </div>
              <div class="evaluator-roster-list" id="roster-list-${qNum}">
                ${rosterItemsHtml}
              </div>
            </div>

            <!-- Answer Evaluation Summary (Section 8) -->
            <div class="answer-summary-block">
              <div class="answer-summary-stats-grid">
                <div>
                  <div class="ans-stat-score">${avgText} <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(${ansEval.total_ratings} ratings)</span></div>
                  <div class="ans-stat-opinions">
                    Agree: <strong style="color:var(--accent-emerald)">${ansEval.agree_count}</strong> &nbsp;|&nbsp; 
                    Disagree: <strong style="color:var(--accent-rose)">${ansEval.disagree_count}</strong>
                  </div>
                </div>
                <div class="ans-histogram-list">
                  ${histBarsHtml}
                </div>
              </div>
            </div>

          </div>
        </article>
      `;
    });

    dom.questionCardsContainer.innerHTML = html;
    attachAnswerEvaluationListeners(respondent.id);

    // Copy buttons
    const copyButtons = dom.questionCardsContainer.querySelectorAll('.copy-answer-btn');
    copyButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const qNum = parseInt(btn.getAttribute('data-qnum'), 10);
        const respObj = respondent.responses.find((r) => r.question_number === qNum);
        if (respObj && respObj.answer) {
          copyTextToClipboard(respObj.answer, () => {
            btn.classList.add('copied');
            const textSpan = btn.querySelector('.copy-btn-text');
            if (textSpan) textSpan.textContent = 'Copied!';
            showToast(`Answer for Question ${qNum} copied!`);
            setTimeout(() => {
              btn.classList.remove('copied');
              if (textSpan) textSpan.textContent = 'Copy';
            }, 2000);
          });
        }
      });
    });

    // Original points / feedback toggles
    const toggles = dom.questionCardsContainer.querySelectorAll('.eval-summary-toggle');
    toggles.forEach((t) => {
      t.addEventListener('click', () => {
        const qNum = t.getAttribute('data-qnum');
        const content = document.getElementById(`eval-content-${qNum}`);
        if (content) {
          const isOpen = content.classList.contains('open');
          content.classList.toggle('open', !isOpen);
          t.classList.toggle('open', !isOpen);
        }
      });
    });
  }

  function attachAnswerEvaluationListeners(candidateId) {
    if (!dom.questionCardsContainer) return;

    // Opinion buttons (Agree / Disagree)
    const opinionButtons = dom.questionCardsContainer.querySelectorAll('.btn-opinion-choice');
    opinionButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const p = window.AssessmentEvaluation.getParticipant();
        if (!p) {
          openIdentityModal();
          return;
        }

        const qNum = parseInt(btn.getAttribute('data-qnum'), 10);
        const choice = btn.getAttribute('data-opinion');
        const isAlreadySelected = btn.classList.contains('selected');
        const newOpinion = isAlreadySelected ? 'clear' : choice;

        try {
          const res = await window.AssessmentEvaluation.evaluateAnswer(candidateId, qNum, {
            opinion: newOpinion
          });
          flashSaveBadge(qNum);
          state.candidateEvaluation = res.candidate_data;
          renderScoreOverviewCards(res.candidate_data);
          updateSingleAnswerCard(qNum, res.candidate_data.answers[qNum]);
        } catch (err) {
          showToast(err.message || 'Error recording opinion');
        }
      });
    });

    // Interactive Star Rating components
    const starGroups = dom.questionCardsContainer.querySelectorAll('.interactive-answer-stars');
    starGroups.forEach(group => {
      const qNum = parseInt(group.getAttribute('data-qnum'), 10);
      const starBtns = group.querySelectorAll('.answer-star-btn');
      const feedbackEl = document.getElementById(`star-feedback-${qNum}`);

      starBtns.forEach(starBtn => {
        const starVal = parseInt(starBtn.getAttribute('data-star'), 10);

        starBtn.addEventListener('mouseenter', () => {
          highlightAnswerStars(starBtns, starVal);
          if (feedbackEl) feedbackEl.textContent = STAR_DESCRIPTIONS[starVal];
        });

        starBtn.addEventListener('mouseleave', () => {
          const curVal = getAnswerRatingState(qNum);
          highlightAnswerStars(starBtns, curVal);
          if (feedbackEl) feedbackEl.textContent = curVal ? STAR_DESCRIPTIONS[curVal] : 'Select Rating';
        });

        starBtn.addEventListener('click', async () => {
          const p = window.AssessmentEvaluation.getParticipant();
          if (!p) {
            openIdentityModal();
            return;
          }

          const curVal = getAnswerRatingState(qNum);
          const newRating = curVal === starVal ? 0 : starVal; // toggle or set

          try {
            const res = await window.AssessmentEvaluation.evaluateAnswer(candidateId, qNum, {
              rating: newRating
            });
            flashSaveBadge(qNum);
            state.candidateEvaluation = res.candidate_data;
            renderScoreOverviewCards(res.candidate_data);
            updateSingleAnswerCard(qNum, res.candidate_data.answers[qNum]);
          } catch (err) {
            showToast(err.message || 'Error recording rating');
          }
        });
      });
    });
  }

  function getAnswerRatingState(qNum) {
    if (!state.candidateEvaluation || !state.candidateEvaluation.answers) return 0;
    const ans = state.candidateEvaluation.answers[qNum];
    return (ans && ans.my_evaluation && ans.my_evaluation.rating) || 0;
  }

  function highlightAnswerStars(starBtns, count) {
    starBtns.forEach(btn => {
      const v = parseInt(btn.getAttribute('data-star'), 10);
      btn.classList.toggle('active', v <= count);
    });
  }

  function flashSaveBadge(qNum) {
    const badge = document.getElementById(`save-badge-${qNum}`);
    if (badge) {
      badge.classList.add('show');
      setTimeout(() => badge.classList.remove('show'), 1600);
    }
  }

  function updateSingleAnswerCard(qNum, ansData) {
    if (!ansData) return;

    // Update Opinion buttons
    const card = document.getElementById(`q-card-${qNum}`);
    if (!card) return;

    const myOp = ansData.my_evaluation ? ansData.my_evaluation.opinion : null;
    const btnAgree = card.querySelector(`.btn-opinion-choice.btn-agree[data-qnum="${qNum}"]`);
    const btnDisagree = card.querySelector(`.btn-opinion-choice.btn-disagree[data-qnum="${qNum}"]`);

    if (btnAgree) btnAgree.classList.toggle('selected', myOp === 'agree');
    if (btnDisagree) btnDisagree.classList.toggle('selected', myOp === 'disagree');

    // Update Stars
    const myRt = ansData.my_evaluation ? ansData.my_evaluation.rating : null;
    const starBtns = card.querySelectorAll(`.answer-star-btn[data-qnum="${qNum}"]`);
    highlightAnswerStars(starBtns, myRt || 0);

    const feedbackEl = document.getElementById(`star-feedback-${qNum}`);
    if (feedbackEl) feedbackEl.textContent = myRt ? STAR_DESCRIPTIONS[myRt] : 'Select Rating';

    // Update Roster
    const rosterListEl = document.getElementById(`roster-list-${qNum}`);
    if (rosterListEl) {
      if (ansData.evaluators && ansData.evaluators.length > 0) {
        let html = '';
        ansData.evaluators.forEach(ev => {
          let opPill = '';
          if (ev.opinion === 'agree') opPill = '<span class="roster-opinion-pill agree">Agree</span>';
          else if (ev.opinion === 'disagree') opPill = '<span class="roster-opinion-pill disagree">Disagree</span>';
          const starsStr = ev.rating ? '★'.repeat(ev.rating) + '☆'.repeat(5 - ev.rating) : 'Unrated';

          html += `
            <div class="evaluator-roster-item">
              <span class="roster-evaluator-name">${escapeHtml(ev.name)}${ev.student_id ? ` <span style="color:var(--text-muted); font-size:0.7rem;">(${escapeHtml(ev.student_id)})</span>` : ''}</span>
              <div class="roster-evaluator-values">
                ${opPill}
                <span class="roster-stars-text">${starsStr}</span>
              </div>
            </div>
          `;
        });
        rosterListEl.innerHTML = html;
      } else {
        rosterListEl.innerHTML = '<div style="font-size:0.75rem; color:var(--text-muted); padding:4px 0;">No evaluator reviews submitted yet for this answer.</div>';
      }
    }
  }

  function updateAnswerCardsState(evalData) {
    if (!evalData || !evalData.answers) return;
    Object.keys(evalData.answers).forEach(qNum => {
      updateSingleAnswerCard(qNum, evalData.answers[qNum]);
    });
  }

  /**
   * Candidate General Assessment Report Modal (Section 11)
   */
  function openCandidateReportModal(evalData) {
    if (!dom.candidateReportModal || !dom.candidateReportModalBody) return;
    dom.candidateReportModal.classList.add('open');

    const cand = state.respondents.find(r => r.id === state.selectedRespondentId) || {};
    const rep = evalData.candidate_report || {};
    const clsSum = rep.classification_summary || {};
    const candCode = `GA-${String(cand.id || 0).padStart(3, '0')}`;

    let qRowsHtml = '';
    (rep.questions || []).forEach(q => {
      const avgStr = q.avg_rating !== null ? `★ ${q.avg_rating} / 5` : '--';
      qRowsHtml += `
        <tr>
          <td><strong>Q${String(q.question_id).padStart(2, '0')}</strong></td>
          <td style="color:#FBBF24; font-family:var(--font-mono); font-weight:700;">${avgStr}</td>
          <td style="color:var(--text-muted); font-family:var(--font-mono);">${q.total_ratings}</td>
          <td style="color:var(--accent-emerald); font-family:var(--font-mono); font-weight:600;">${q.agree_count}</td>
          <td style="color:var(--accent-rose); font-family:var(--font-mono); font-weight:600;">${q.disagree_count}</td>
        </tr>
      `;
    });

    dom.candidateReportModalBody.innerHTML = `
      <div style="margin-bottom: 20px;">
        <div style="font-size: 1.3rem; font-weight: 800; color: var(--text-primary);">${escapeHtml(cand.name)}</div>
        <div style="font-size: 0.82rem; color: var(--accent-sky); font-family:var(--font-mono); margin-top:2px;">
          ${candCode} • Division ${escapeHtml(cand.division || '')}
        </div>
      </div>

      <!-- Classification Breakdown -->
      <div style="background:var(--surface-secondary); padding:16px; border-radius:var(--radius-md); border:1px solid var(--border-color); margin-bottom:20px;">
        <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:10px;">
          Evaluator Classifications
        </div>
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; text-align:center;">
          <div style="padding:10px; background:var(--surface-primary); border-radius:var(--radius-sm); border-top:3px solid var(--accent-emerald);">
            <div style="font-size:1.4rem; font-weight:800; color:var(--accent-emerald);">${clsSum.good_count || 0}</div>
            <div style="font-size:0.72rem; color:var(--text-secondary); margin-top:2px;">Good Candidate (${clsSum.good_percentage || 0}%)</div>
          </div>
          <div style="padding:10px; background:var(--surface-primary); border-radius:var(--radius-sm); border-top:3px solid var(--accent-amber);">
            <div style="font-size:1.4rem; font-weight:800; color:var(--accent-amber);">${clsSum.potential_count || 0}</div>
            <div style="font-size:0.72rem; color:var(--text-secondary); margin-top:2px;">Has Potential (${clsSum.potential_percentage || 0}%)</div>
          </div>
          <div style="padding:10px; background:var(--surface-primary); border-radius:var(--radius-sm); border-top:3px solid var(--accent-rose);">
            <div style="font-size:1.4rem; font-weight:800; color:var(--accent-rose);">${clsSum.rejected_count || 0}</div>
            <div style="font-size:0.72rem; color:var(--text-secondary); margin-top:2px;">Rejected (${clsSum.rejected_percentage || 0}%)</div>
          </div>
        </div>
      </div>

      <!-- Overall Score Summary -->
      <div style="background:var(--surface-secondary); padding:16px; border-radius:var(--radius-md); border:1px solid var(--border-color); margin-bottom:20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px;">
        <div>
          <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Overall General Assessment Score</div>
          <div style="font-size:2.2rem; font-weight:800; color:var(--accent-sky); font-family:var(--font-mono); margin-top:4px;">
            ${rep.general_assessment_score !== null ? rep.general_assessment_score : '--'} <span style="font-size:1rem; color:var(--text-muted);">/ 100</span>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Average Rating Across All Answers</div>
          <div style="font-size:1.4rem; font-weight:700; color:#FBBF24; font-family:var(--font-mono); margin-top:4px;">
            ${rep.overall_avg_rating !== null ? `★ ${rep.overall_avg_rating} / 5` : 'Not rated'}
          </div>
        </div>
      </div>

      <!-- Question-by-Question Table (Section 11) -->
      <div style="border:1px solid var(--border-color); border-radius:var(--radius-md); overflow:hidden;">
        <div style="padding:10px 14px; background:var(--surface-secondary); font-size:0.78rem; font-weight:700; color:var(--text-primary);">
          Answer-Level Evaluation Matrix (28 Questions)
        </div>
        <div style="overflow-x:auto;">
          <table class="community-ledger-table" style="font-size:0.8rem;">
            <thead>
              <tr>
                <th>Question</th>
                <th>Avg Rating</th>
                <th>Total Ratings</th>
                <th>Agree</th>
                <th>Disagree</th>
              </tr>
            </thead>
            <tbody>
              ${qRowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * Individual Evaluator Report Modal (Section 10)
   */
  function openEvaluatorReportModal(evalData) {
    if (!dom.evaluatorReportModal || !dom.evaluatorReportModalBody) return;
    dom.evaluatorReportModal.classList.add('open');

    const reports = evalData.individual_evaluator_reports || [];
    const cand = state.respondents.find(r => r.id === state.selectedRespondentId) || {};

    if (reports.length === 0) {
      dom.evaluatorReportModalBody.innerHTML = `
        <div style="text-align:center; padding:50px 20px; color:var(--text-muted);">
          No evaluators have submitted evaluations for ${escapeHtml(cand.name)} yet.
        </div>
      `;
      return;
    }

    let cardsHtml = '';
    reports.forEach(ev => {
      let clsBadge = '<span style="color:var(--text-muted)">Unclassified</span>';
      if (ev.classification === 'good_candidate') clsBadge = '<span style="color:var(--accent-emerald); font-weight:700;">🌟 GOOD CANDIDATE</span>';
      else if (ev.classification === 'has_potential') clsBadge = '<span style="color:var(--accent-amber); font-weight:700;">⏳ HAS POTENTIAL</span>';
      else if (ev.classification === 'rejected') clsBadge = '<span style="color:var(--accent-rose); font-weight:700;">❌ REJECTED</span>';

      const avgStr = ev.avg_rating !== null ? `★ ${ev.avg_rating} / 5` : '--';
      const scoreStr = ev.general_assessment_score !== null ? `${ev.general_assessment_score} / 100` : '--';

      // Q-by-Q row for this evaluator
      let qListHtml = '';
      Object.keys(ev.evaluations || {}).forEach(qid => {
        const item = ev.evaluations[qid];
        const stars = item.rating ? '★'.repeat(item.rating) : '-';
        const op = item.opinion ? (item.opinion === 'agree' ? 'Agree' : 'Disagree') : '-';
        qListHtml += `
          <span style="display:inline-block; margin:2px 4px; padding:3px 7px; background:var(--surface-primary); border:1px solid var(--border-subtle); border-radius:4px; font-size:0.72rem; font-family:var(--font-mono);">
            Q${qid}: <span style="color:${item.opinion === 'agree' ? 'var(--accent-emerald)' : 'var(--accent-rose)'}">${op}</span> · <span style="color:#FBBF24">${stars}</span>
          </span>
        `;
      });

      cardsHtml += `
        <div style="background:var(--surface-secondary); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:18px; margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px; border-bottom:1px solid var(--border-subtle); padding-bottom:10px;">
            <div>
              <div style="font-size:1.05rem; font-weight:800; color:var(--text-primary);">${escapeHtml(ev.name)}</div>
              ${ev.student_id ? `<div style="font-size:0.72rem; color:var(--text-muted); font-family:var(--font-mono);">${escapeHtml(ev.student_id)}</div>` : ''}
            </div>
            <div>${clsBadge}</div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:12px;">
            <div style="background:var(--surface-primary); padding:8px 10px; border-radius:var(--radius-sm);">
              <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase;">Answers Evaluated</div>
              <div style="font-size:1.1rem; font-weight:700; color:var(--text-primary); font-family:var(--font-mono); margin-top:2px;">
                ${ev.answers_evaluated} / ${ev.total_questions}
              </div>
            </div>
            <div style="background:var(--surface-primary); padding:8px 10px; border-radius:var(--radius-sm);">
              <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase;">Agree / Disagree</div>
              <div style="font-size:1.1rem; font-weight:700; color:var(--text-primary); font-family:var(--font-mono); margin-top:2px;">
                <span style="color:var(--accent-emerald)">${ev.agree_count}</span> / <span style="color:var(--accent-rose)">${ev.disagree_count}</span>
              </div>
            </div>
            <div style="background:var(--surface-primary); padding:8px 10px; border-radius:var(--radius-sm);">
              <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase;">Average Rating</div>
              <div style="font-size:1.1rem; font-weight:700; color:#FBBF24; font-family:var(--font-mono); margin-top:2px;">
                ${avgStr}
              </div>
            </div>
            <div style="background:var(--surface-primary); padding:8px 10px; border-radius:var(--radius-sm);">
              <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase;">GA Score Given</div>
              <div style="font-size:1.1rem; font-weight:700; color:var(--accent-sky); font-family:var(--font-mono); margin-top:2px;">
                ${scoreStr}
              </div>
            </div>
          </div>

          ${qListHtml ? `
            <div style="margin-top:8px;">
              <div style="font-size:0.70rem; color:var(--text-muted); margin-bottom:4px; text-transform:uppercase; letter-spacing:0.04em;">Question-by-Question Evaluations:</div>
              <div style="display:flex; flex-wrap:wrap;">${qListHtml}</div>
            </div>
          ` : ''}
        </div>
      `;
    });

    dom.evaluatorReportModalBody.innerHTML = `
      <div style="margin-bottom:16px;">
        <h3 style="font-size:1.15rem; font-weight:800; color:var(--text-primary);">Evaluator Reports for ${escapeHtml(cand.name)}</h3>
        <p style="font-size:0.78rem; color:var(--text-muted);">Independent records of decisions made by each registered evaluator.</p>
      </div>
      <div>
        ${cardsHtml}
      </div>
    `;
  }

  /**
   * Master Candidate Overview Dashboard Modal (Section 12 & 13)
   */
  async function openOverviewModal() {
    if (dom.overviewModal) dom.overviewModal.classList.add('open');
    if (!dom.overviewModalBody) return;

    dom.overviewModalBody.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted)">Loading candidate overview & dashboard metrics...</div>';

    try {
      const ov = await window.AssessmentEvaluation.fetchOverview();
      renderOverviewModalContent(ov);
    } catch (err) {
      dom.overviewModalBody.innerHTML = `
        <div style="text-align:center; padding:40px; color:var(--accent-rose)">
          Failed to load overview data. Ensure server is active.
        </div>
      `;
    }
  }

  function closeOverviewModal() {
    if (dom.overviewModal) dom.overviewModal.classList.remove('open');
  }

  function renderOverviewModalContent(ov) {
    if (!dom.overviewModalBody) return;

    const p = ov.participation || {};
    const candidates = ov.candidates_overview || [];

    // Master Table Rows (Section 12 & 13)
    let rowsHtml = '';
    candidates.forEach(c => {
      const scoreStr = c.general_assessment_score !== null ? `<strong>${c.general_assessment_score}%</strong>` : '--';
      const avgStr = c.avg_rating !== null ? `★ ${c.avg_rating}/5` : '--';

      rowsHtml += `
        <tr class="master-candidate-row" data-cid="${c.candidate_id}" style="cursor:pointer;" title="Click to view ${escapeHtml(c.name)}">
          <td>
            <strong style="color:var(--text-primary)">${escapeHtml(c.name)}</strong>
            <div style="font-size:0.70rem; color:var(--text-muted); font-family:var(--font-mono);">${c.code} • Div ${escapeHtml(c.division)}</div>
          </td>
          <td style="color:var(--accent-emerald); font-weight:700; font-family:var(--font-mono);">
            ${c.good_candidate} <span style="font-size:0.72rem; color:var(--text-muted);">(${c.good_percentage}%)</span>
          </td>
          <td style="color:var(--accent-amber); font-weight:700; font-family:var(--font-mono);">
            ${c.has_potential} <span style="font-size:0.72rem; color:var(--text-muted);">(${c.potential_percentage}%)</span>
          </td>
          <td style="color:var(--accent-rose); font-weight:700; font-family:var(--font-mono);">
            ${c.rejected} <span style="font-size:0.72rem; color:var(--text-muted);">(${c.rejected_percentage}%)</span>
          </td>
          <td style="color:var(--accent-sky); font-family:var(--font-mono);">${scoreStr}</td>
          <td style="color:#FBBF24; font-family:var(--font-mono);">${avgStr}</td>
          <td style="color:var(--text-muted); font-family:var(--font-mono);">${c.total_ratings}</td>
        </tr>
      `;
    });

    // Evaluator Ledger Rows
    let ledgerHtml = '';
    (ov.evaluators_ledger || []).forEach(ev => {
      ledgerHtml += `
        <tr>
          <td>
            <strong style="color:var(--text-primary)">${escapeHtml(ev.name)}</strong>
            ${ev.student_id ? `<div style="font-size:0.70rem; color:var(--text-muted); font-family:var(--font-mono);">${escapeHtml(ev.student_id)}</div>` : ''}
          </td>
          <td style="font-family:var(--font-mono);">${ev.candidates_classified}</td>
          <td style="font-family:var(--font-mono);">${ev.answers_evaluated}</td>
          <td style="color:#FBBF24; font-family:var(--font-mono); font-weight:700;">${ev.avg_rating_given !== null ? `★ ${ev.avg_rating_given}/5` : '--'}</td>
          <td style="font-size:0.72rem; color:var(--text-muted);">${formatDate(ev.last_seen)}</td>
        </tr>
      `;
    });

    dom.overviewModalBody.innerHTML = `
      <!-- Overall Participation Counter Banner -->
      <div class="participation-tracker-bar" style="margin-bottom:20px;">
        <div class="part-metric-item">
          <span class="part-metric-label">Registered Evaluators</span>
          <span class="part-metric-val" style="color:var(--accent-sky)">${p.total_evaluators || 0}</span>
        </div>
        <div class="part-metric-item">
          <span class="part-metric-label">Classifying Evaluators</span>
          <span class="part-metric-val" style="color:var(--accent-emerald)">${p.classifying_evaluators || 0}</span>
        </div>
        <div class="part-metric-item">
          <span class="part-metric-label">Answer Evaluations</span>
          <span class="part-metric-val" style="color:var(--accent-amber)">${p.total_answer_evaluations || 0}</span>
        </div>
        <div class="part-metric-item">
          <span class="part-metric-label">Star Ratings Given</span>
          <span class="part-metric-val" style="color:#FBBF24">${p.total_star_ratings || 0}</span>
        </div>
        <div class="part-metric-item">
          <span class="part-metric-label">Total Agrees / Disagrees</span>
          <span class="part-metric-val">${p.total_agrees || 0} / ${p.total_disagrees || 0}</span>
        </div>
      </div>

      <!-- Candidate Classification Overview Table (Section 12 & 13) -->
      <div style="margin-bottom:24px;">
        <div style="font-size:0.95rem; font-weight:800; color:var(--text-primary); margin-bottom:10px;">
          General Assessment — Candidate Classification & Scoring Matrix
        </div>
        <div style="overflow-x:auto; border:1px solid var(--border-color); border-radius:var(--radius-md);">
          <table class="community-ledger-table" style="font-size:0.8rem;">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Good Candidate</th>
                <th>Has Potential</th>
                <th>Rejected</th>
                <th>GA Score</th>
                <th>Avg Rating</th>
                <th>Total Ratings</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Evaluator Participation Ledger -->
      <div>
        <div style="font-size:0.95rem; font-weight:800; color:var(--text-primary); margin-bottom:10px;">
          Registered Evaluator Ledger (${(ov.evaluators_ledger || []).length})
        </div>
        <div style="overflow-x:auto; border:1px solid var(--border-color); border-radius:var(--radius-md);">
          <table class="community-ledger-table" style="font-size:0.8rem;">
            <thead>
              <tr>
                <th>Evaluator</th>
                <th>Classified</th>
                <th>Answers Evaluated</th>
                <th>Avg Rating Given</th>
                <th>Last Active</th>
              </tr>
            </thead>
            <tbody>
              ${ledgerHtml || '<tr><td colspan="5" style="text-align:center; padding:15px; color:var(--text-muted)">No evaluator activity recorded yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Row clicks navigate directly to candidate
    const masterRows = dom.overviewModalBody.querySelectorAll('.master-candidate-row');
    masterRows.forEach(row => {
      row.addEventListener('click', () => {
        const cid = parseInt(row.getAttribute('data-cid'), 10);
        if (cid) {
          closeOverviewModal();
          selectRespondent(cid, true);
        }
      });
    });
  }

  /**
   * Render Quick Jump Navigation Bar
   */
  function renderQuickJumpBar(respondent) {
    if (!dom.questionJumpContainer) return;

    let pillsHtml = '';
    respondent.responses.forEach((resp) => {
      const qNum = resp.question_number;
      const isSecA = resp.section_id === 'A';
      const secClass = isSecA ? 'sec-a' : 'sec-b';
      const isBlankClass = !resp.is_answered ? 'is-blank' : '';
      const tooltip = `Q${qNum}: ${isSecA ? 'Leadership' : 'Technical'}${!resp.is_answered ? ' (Blank)' : ''}`;

      pillsHtml += `
        <button type="button" 
                class="q-jump-pill ${secClass} ${isBlankClass}" 
                data-target="q-card-${qNum}" 
                title="${tooltip}"
                aria-label="Scroll to Question ${qNum}">
          ${qNum}
        </button>
      `;
    });

    dom.questionJumpContainer.innerHTML = `
      <nav class="question-jump-wrapper" aria-label="Question Jump Navigation">
        <div class="jump-bar-header">
          <div class="jump-bar-title">Jump to Question</div>
          <div class="jump-legend">
            <div class="legend-item">
              <span class="legend-dot sec-a"></span>
              <span>Sec A: Leadership (Q1-12)</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot sec-b"></span>
              <span>Sec B: Technical (Q13-28)</span>
            </div>
          </div>
        </div>
        <div class="jump-pills-container">
          ${pillsHtml}
        </div>
      </nav>
    `;

    const pills = dom.questionJumpContainer.querySelectorAll('.q-jump-pill');
    pills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const targetId = pill.getAttribute('data-target');
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          targetEl.classList.add('highlighted');
          setTimeout(() => {
            targetEl.classList.remove('highlighted');
          }, 1400);
        }
      });
    });
  }

  function toggleGlobalEvaluation() {
    state.showEvaluationGlobal = !state.showEvaluationGlobal;
    if (dom.toggleEvaluationBtn) {
      dom.toggleEvaluationBtn.classList.toggle('active', state.showEvaluationGlobal);
      dom.toggleEvaluationBtn.querySelector('span').textContent = state.showEvaluationGlobal ? 'Hide Details' : 'Show Details';
    }

    if (!dom.questionCardsContainer) return;
    const contents = dom.questionCardsContainer.querySelectorAll('.eval-content');
    const toggles = dom.questionCardsContainer.querySelectorAll('.eval-summary-toggle');

    contents.forEach((c) => c.classList.toggle('open', state.showEvaluationGlobal));
    toggles.forEach((t) => t.classList.toggle('open', state.showEvaluationGlobal));
  }

  function startRealtimePolling() {
    if (state.pollingTimer) clearInterval(state.pollingTimer);

    state.pollingTimer = setInterval(async () => {
      if (document.hidden) return;

      if (dom.overviewModal && dom.overviewModal.classList.contains('open')) {
        try {
          const ov = await window.AssessmentEvaluation.fetchOverview();
          renderOverviewModalContent(ov);
        } catch (e) {}
        return;
      }

      if (state.activeAssessmentType === 'general' && state.selectedRespondentId) {
        try {
          const evalData = await window.AssessmentEvaluation.fetchCandidate(state.selectedRespondentId);
          state.candidateEvaluation = evalData;

          // Silently update components without clearing active inputs
          const activeEl = document.activeElement;
          const isInteracting = activeEl && (activeEl.tagName === 'INPUT' || activeEl.classList.contains('answer-star-btn'));
          if (!isInteracting) {
            renderCandidateStatusAbove(evalData);
            renderScoreOverviewCards(evalData);
            updateAnswerCardsState(evalData);
          }
        } catch (e) {}
      }
    }, 5000);
  }

  function getRespondentIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const id = parseInt(params.get('id'), 10);
    return !isNaN(id) ? id : null;
  }

  function updateUrlWithRespondentId(id) {
    const url = new URL(window.location);
    url.searchParams.set('id', id);
    window.history.pushState({ id }, '', url);
  }

  function copyTextToClipboard(text, onSuccess) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(() => fallbackCopy(text, onSuccess));
    } else {
      fallbackCopy(text, onSuccess);
    }
  }

  function fallbackCopy(text, onSuccess) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
  }

  let toastTimer = null;
  function showToast(message) {
    if (!dom.toastMessage) return;
    clearTimeout(toastTimer);
    dom.toastMessage.querySelector('.toast-text').textContent = message;
    dom.toastMessage.classList.add('show');
    toastTimer = setTimeout(() => {
      dom.toastMessage.classList.remove('show');
    }, 2400);
  }

  function showCriticalError(msg) {
    if (dom.mainContentArea) {
      dom.mainContentArea.innerHTML = `
        <div style="padding: 60px 20px; text-align: center; color: var(--accent-rose);">
          <h2>Error Loading Assessment</h2>
          <p style="margin-top: 10px; color: var(--text-secondary);">${escapeHtml(msg)}</p>
        </div>
      `;
    }
  }

  function formatDate(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return isoStr;
    }
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
