/**
 * General Assessment Response Viewer - Evaluation API Client
 * Manages participant identity, candidate classification (Good Candidate | Has Potential | Rejected),
 * answer-level evaluations (Opinion: Agree/Disagree + 1-5 Star Ratings), and report data fetching.
 */

window.AssessmentEvaluation = (function () {
  'use strict';

  const STORAGE_KEY = 'general_assessment_evaluator';
  let currentParticipant = null;
  let activeCandidateData = null;

  function loadStoredParticipant() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        currentParticipant = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Could not read participant from localStorage', e);
    }
    return currentParticipant;
  }

  function getParticipant() {
    return currentParticipant;
  }

  function setParticipant(p) {
    currentParticipant = p;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch (e) {
      console.error(e);
    }
  }

  function clearParticipant() {
    currentParticipant = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('general_assessment_participant'); // clear legacy key too
    } catch (e) {
      console.error(e);
    }
  }

  // Offline LocalStorage helpers for standalone/offline operation
  function getOfflineEvaluations() {
    try {
      return JSON.parse(localStorage.getItem('general_assessment_offline_evals') || '{}');
    } catch {
      return {};
    }
  }

  function saveOfflineEvaluations(data) {
    try {
      localStorage.setItem('general_assessment_offline_evals', JSON.stringify(data));
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }
  }

  function getOfflineClassifications() {
    try {
      return JSON.parse(localStorage.getItem('general_assessment_offline_classifications') || '{}');
    } catch {
      return {};
    }
  }

  function saveOfflineClassifications(data) {
    try {
      localStorage.setItem('general_assessment_offline_classifications', JSON.stringify(data));
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }
  }

  function buildOfflineCandidateData(candidateId) {
    const offlineEvals = getOfflineEvaluations();
    const offlineClasses = getOfflineClassifications();
    const cidStr = String(candidateId);

    const userClass = (offlineClasses[cidStr] && offlineClasses[cidStr][currentParticipant ? currentParticipant.id : '']) || null;
    const userAnswers = (offlineEvals[cidStr] && offlineEvals[cidStr][currentParticipant ? currentParticipant.id : '']) || {};

    const answersMap = {};
    for (let q = 1; q <= 28; q++) {
      const uItem = userAnswers[String(q)] || {};
      answersMap[q] = {
        question_id: q,
        user_opinion: uItem.opinion || null,
        user_rating: uItem.rating || null,
        avg_rating: uItem.rating || null,
        total_ratings: uItem.rating ? 1 : 0,
        agree_count: uItem.opinion === 'agree' ? 1 : 0,
        disagree_count: uItem.opinion === 'disagree' ? 1 : 0,
        opinion_distribution: {
          agree: uItem.opinion === 'agree' ? 1 : 0,
          disagree: uItem.opinion === 'disagree' ? 1 : 0
        },
        rating_distribution: {
          1: uItem.rating === 1 ? 1 : 0,
          2: uItem.rating === 2 ? 1 : 0,
          3: uItem.rating === 3 ? 1 : 0,
          4: uItem.rating === 4 ? 1 : 0,
          5: uItem.rating === 5 ? 1 : 0
        },
        evaluators: []
      };
    }

    const clsSummary = {
      good_candidate: { count: userClass === 'good_candidate' ? 1 : 0, percentage: userClass === 'good_candidate' ? 100 : 0, evaluators: [] },
      has_potential: { count: userClass === 'has_potential' ? 1 : 0, percentage: userClass === 'has_potential' ? 100 : 0, evaluators: [] },
      rejected: { count: userClass === 'rejected' ? 1 : 0, percentage: userClass === 'rejected' ? 100 : 0, evaluators: [] },
      total_classified: userClass ? 1 : 0
    };

    return {
      candidate_id: Number(candidateId),
      answers: answersMap,
      classification_summary: clsSummary,
      user_evaluation: {
        classification: userClass,
        evaluated_count: Object.keys(userAnswers).length,
        answers: userAnswers
      },
      metrics: {
        avg_rating: null,
        total_evaluators: currentParticipant ? 1 : 0,
        evaluations_count: Object.keys(userAnswers).length,
        general_assessment_score: null
      }
    };
  }

  async function validateStoredParticipant() {
    if (!currentParticipant || !currentParticipant.id) return null;
    try {
      const res = await fetch(`/api/participant/profile?participant_id=${encodeURIComponent(currentParticipant.id)}`);
      if (res.status === 404) {
        clearParticipant();
        return null;
      }
      return currentParticipant;
    } catch (e) {
      // Offline fallback: participant in localStorage is preserved
      return currentParticipant;
    }
  }

  async function registerParticipant(name, studentId) {
    try {
      const res = await fetch('/api/participant/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          student_id: (studentId || '').trim() || null
        })
      });

      if (res.ok) {
        const data = await res.json();
        setParticipant(data.participant);
        return data;
      }
    } catch (e) {
      console.info('Offline mode: saving participant to localStorage');
    }

    // Offline registration fallback
    const offlineParticipant = {
      id: 'p_offline_' + Date.now().toString(36),
      name: name.trim(),
      student_id: (studentId || '').trim() || null
    };
    setParticipant(offlineParticipant);
    return { participant: offlineParticipant, message: 'Offline participant registered' };
  }

  async function fetchCandidate(candidateId) {
    const pid = currentParticipant ? currentParticipant.id : '';
    try {
      const res = await fetch(`/api/candidate/${candidateId}?participant_id=${encodeURIComponent(pid)}`);
      if (res.ok) {
        const data = await res.json();
        activeCandidateData = data;
        return data;
      }
    } catch (e) {
      // Fall through to offline data
    }
    const offlineData = buildOfflineCandidateData(candidateId);
    activeCandidateData = offlineData;
    return offlineData;
  }

  async function classifyCandidate(candidateId, classification) {
    if (!currentParticipant) {
      throw new Error('Please identify yourself first to classify candidates.');
    }

    try {
      const res = await fetch('/api/candidate/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_id: currentParticipant.id,
          candidate_id: candidateId,
          classification: classification
        })
      });

      if (res.ok) {
        const data = await res.json();
        activeCandidateData = data.candidate_data;
        return data;
      }
    } catch (e) {
      // Offline mode
    }

    const offlineClasses = getOfflineClassifications();
    const cidStr = String(candidateId);
    if (!offlineClasses[cidStr]) offlineClasses[cidStr] = {};
    offlineClasses[cidStr][currentParticipant.id] = classification;
    saveOfflineClassifications(offlineClasses);

    const cdata = buildOfflineCandidateData(candidateId);
    activeCandidateData = cdata;
    return { success: true, classification, candidate_data: cdata };
  }

  async function evaluateAnswer(candidateId, questionId, { opinion, rating }) {
    if (!currentParticipant) {
      throw new Error('Please identify yourself first to evaluate answers.');
    }

    const payload = {
      participant_id: currentParticipant.id,
      candidate_id: candidateId,
      question_id: questionId
    };

    if (opinion !== undefined) payload.opinion = opinion;
    if (rating !== undefined) payload.rating = rating;

    try {
      const res = await fetch('/api/answer/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        activeCandidateData = data.candidate_data;
        return data;
      }
    } catch (e) {
      // Offline mode
    }

    const offlineEvals = getOfflineEvaluations();
    const cidStr = String(candidateId);
    const qidStr = String(questionId);
    if (!offlineEvals[cidStr]) offlineEvals[cidStr] = {};
    if (!offlineEvals[cidStr][currentParticipant.id]) offlineEvals[cidStr][currentParticipant.id] = {};
    
    const existing = offlineEvals[cidStr][currentParticipant.id][qidStr] || {};
    if (opinion !== undefined) existing.opinion = opinion;
    if (rating !== undefined) existing.rating = rating;
    offlineEvals[cidStr][currentParticipant.id][qidStr] = existing;
    saveOfflineEvaluations(offlineEvals);

    const cdata = buildOfflineCandidateData(candidateId);
    activeCandidateData = cdata;
    return { success: true, candidate_data: cdata };
  }

  async function fetchOverview() {
    const pid = currentParticipant ? currentParticipant.id : '';
    try {
      const res = await fetch(`/api/evaluation/overview?participant_id=${encodeURIComponent(pid)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Offline fallback
    }

    // Build offline overview
    const candidates = (window.ASSESSMENT_DATA ? window.ASSESSMENT_DATA.respondents : []) || [];
    const candidatesOverview = candidates.map(c => {
      const cdata = buildOfflineCandidateData(c.id);
      return {
        candidate_id: c.id,
        code: `GA-${String(c.id).padStart(3, '0')}`,
        name: c.name,
        division: c.division,
        general_assessment_score: null,
        avg_rating: null,
        total_ratings: 0,
        good_candidate_count: cdata.classification_summary.good_candidate.count,
        has_potential_count: cdata.classification_summary.has_potential.count,
        rejected_count: cdata.classification_summary.rejected.count,
        my_classification: cdata.user_evaluation.classification
      };
    });

    return {
      participation: {
        total_evaluators: currentParticipant ? 1 : 0,
        total_candidates: candidates.length,
        total_evaluations_submitted: 0
      },
      candidates_overview: candidatesOverview
    };
  }

  return {
    loadStoredParticipant,
    getParticipant,
    setParticipant,
    clearParticipant,
    validateStoredParticipant,
    registerParticipant,
    fetchCandidate,
    classifyCandidate,
    evaluateAnswer,
    fetchOverview
  };
})();
