/**
 * General Assessment Viewer - Search & Filter Module
 * Fast, case-insensitive, multi-attribute search and division filtering
 */

window.AssessmentSearch = (function () {
  'use strict';

  let activeDivision = 'ALL'; // 'ALL', 'A', 'B'
  let currentQuery = '';
  let onChangeCallback = null;
  let allRespondents = [];

  function init(respondents, onChange) {
    allRespondents = respondents || [];
    onChangeCallback = onChange || null;
  }

  /**
   * Filter respondents list based on query and selected division
   * @param {Array} respondents - Full list of respondent objects
   * @param {string} query - Search string
   * @param {string} division - 'ALL', 'A', or 'B'
   * @returns {Array} Filtered respondents
   */
  function filterRespondents(respondents, query, division) {
    const list = respondents || allRespondents || [];
    if (!Array.isArray(list)) return [];

    const cleanQuery = (query !== undefined ? query : currentQuery || '').trim().toLowerCase();
    const targetDivision = (division !== undefined ? division : activeDivision || 'ALL').toUpperCase();

    return list.filter((r) => {
      // 1. Division check
      if (targetDivision !== 'ALL') {
        const rDiv = (r.division || '').toUpperCase();
        if (rDiv !== targetDivision) {
          return false;
        }
      }

      // 2. Query check (if empty, matches all in this division)
      if (!cleanQuery) return true;

      // Check ID match (e.g., '1', '#1', 'id:1', 'GA-001', 'ga-1')
      const idStr = String(r.id);
      const codeStr = `ga-${String(r.id).padStart(3, '0')}`.toLowerCase();
      if (
        idStr === cleanQuery ||
        `#${idStr}` === cleanQuery ||
        `id ${idStr}` === cleanQuery ||
        `id:${idStr}` === cleanQuery ||
        codeStr === cleanQuery ||
        codeStr.includes(cleanQuery)
      ) {
        return true;
      }

      // Check Name match (case-insensitive substring)
      const nameStr = (r.name || '').toLowerCase();
      if (nameStr.includes(cleanQuery)) {
        return true;
      }

      // Check Division match
      const divStr = (r.division || '').toLowerCase();
      if (
        cleanQuery === divStr ||
        cleanQuery === `division ${divStr}` ||
        cleanQuery === `div ${divStr}` ||
        cleanQuery === `class ${divStr}`
      ) {
        return true;
      }

      return false;
    });
  }

  function setDivision(div) {
    activeDivision = div || 'ALL';
    if (onChangeCallback) onChangeCallback(filterRespondents());
  }

  function setQuery(q) {
    currentQuery = q || '';
    if (onChangeCallback) onChangeCallback(filterRespondents());
  }

  function setActiveDivision(div) {
    setDivision(div);
  }

  function getActiveDivision() {
    return activeDivision;
  }

  function setCurrentQuery(q) {
    setQuery(q);
  }

  function getCurrentQuery() {
    return currentQuery;
  }

  return {
    init,
    filterRespondents,
    setDivision,
    setActiveDivision,
    getActiveDivision,
    setQuery,
    setCurrentQuery,
    getCurrentQuery
  };
})();
