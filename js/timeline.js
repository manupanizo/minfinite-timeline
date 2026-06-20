// Timeline SVG component — adapted from infinite-timeline Rails app
// Converted from ES module to plain global (window.Timeline)
// Zoom state is per-call (closure), safe for single-instance use

// --- Zoom State (shared across re-renders of same instance, reset on new call) ---
let currentMinDate = null;
let currentMaxDate = null;
let originalMinDate = null;
let originalMaxDate = null;

// --- Range Selection State ---
let isSelecting = false;
let selectionStartX = null;
let selectionStartDate = null;
let selectionRect = null;

const Timeline = ({
  width = '100%',
  height = '100%',
  events = [],
  parentElement = null
}) => {

  const timelineHeight = parseInt(height, 10) || 400;
  const axisY = timelineHeight * 0.9;

  function getContainerWidth() {
    let availableWidth = 0;
    if (parentElement) {
      availableWidth = parentElement.getBoundingClientRect().width;
    }
    if (!availableWidth || availableWidth === 0) {
      availableWidth = window.innerWidth * 0.9;
    }
    return Math.max(600, Math.min(2400, availableWidth));
  }

  const container = document.createElement('div');
  container.className = 'timeline-component';
  container.style.width = width;
  container.style.height = `${timelineHeight}px`;
  container.style.position = 'relative';
  container.style.border = '1px solid var(--color-gray)';
  container.tabIndex = 0;

  let isTimelineActive = false;
  container.addEventListener('mouseenter', () => { isTimelineActive = true; });
  container.addEventListener('mouseleave', () => { isTimelineActive = false; });
  container.addEventListener('focusin', () => { isTimelineActive = true; });
  container.addEventListener('focusout', (e) => {
    if (e.relatedTarget && zoomControls && zoomControls.contains(e.relatedTarget)) return;
    isTimelineActive = false;
  });
  container.addEventListener('mousedown', () => {
    try { container.focus({ preventScroll: true }); } catch { try { container.focus(); } catch {} }
    isTimelineActive = true;
    updateControlsActivationUI();
  });

  function getMinMaxTimestamps(evts) {
    if (!evts.length) return [0, 1];
    let min = getEventTimestamp(evts[0]);
    let max = getEventTimestamp(evts[0]);
    for (let i = 1; i < evts.length; i++) {
      const ts = getEventTimestamp(evts[i]);
      if (ts < min) min = ts;
      if (ts > max) max = ts;
    }
    return [min, max];
  }

  function addRangeMargin([min, max], marginPercent = 0.05) {
    const range = max - min;
    const leftMargin = range * marginPercent;
    const rightMargin = range * (marginPercent * 4.5);
    return [min - leftMargin, max + rightMargin];
  }

  if (!events || events.length === 0) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--color-muted);font-family:var(--font-body);">No events to display. Add some events above.</div>';
    return container;
  }

  let sortedEvents = events.slice().sort((a, b) => getEventTimestamp(a) - getEventTimestamp(b));

  // Reset zoom state for each new Timeline call
  currentMinDate = null;
  currentMaxDate = null;
  originalMinDate = null;
  originalMaxDate = null;

  function getEventTimestamp(event) {
    const year = event.is_bc ? -event.year : event.year;
    const month = (event.month || 1) - 1;
    const day = (event.day || 1) - 1;
    return year + (month / 12) + (day / 365);
  }

  function groupEventsByDay(evts) {
    const groups = {};
    evts.forEach(event => {
      const year = event.is_bc ? `-${String(event.year).padStart(4, '0')}` : String(event.year).padStart(4, '0');
      const month = String(event.month || 1).padStart(2, '0');
      const day = String(event.day || 1).padStart(2, '0');
      const key = `${year}-${month}-${day}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });
    return Object.entries(groups).map(([dateKey, evts]) => ({ dateKey, events: evts }));
  }

  function groupEventsByMonth(evts) {
    const groups = {};
    evts.forEach(event => {
      const year = event.is_bc ? `-${String(event.year).padStart(4, '0')}` : String(event.year).padStart(4, '0');
      const month = String(event.month || 1).padStart(2, '0');
      const key = `${year}-${month}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });
    return Object.entries(groups).map(([dateKey, evts]) => ({ dateKey, events: evts }));
  }

  function groupEventsByYear(evts) {
    const groups = {};
    evts.forEach(event => {
      const key = event.is_bc ? `${event.year} BC` : String(event.year).padStart(4, '0');
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });
    return Object.entries(groups).map(([dateKey, evts]) => ({ dateKey, events: evts }));
  }

  function groupEventsByDecade(evts) {
    const groups = {};
    evts.forEach(event => {
      const year = event.is_bc ? -event.year : event.year;
      const decadeStart = year >= 0 ? Math.floor(year / 10) * 10 : Math.ceil(year / 10) * 10;
      const key = event.is_bc ? `${Math.abs(decadeStart)}s BC` : `${decadeStart}s`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });
    return Object.entries(groups).map(([dateKey, evts]) => ({ dateKey, events: evts }));
  }

  function groupEventsByCentury(evts) {
    const groups = {};
    evts.forEach(event => {
      const year = event.is_bc ? -event.year : event.year;
      const centuryStart = year >= 0 ? Math.floor(year / 100) * 100 : Math.ceil(year / 100) * 100;
      const key = event.is_bc ? `${Math.abs(centuryStart)}s BC` : `${centuryStart}s`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });
    return Object.entries(groups).map(([dateKey, evts]) => ({ dateKey, events: evts }));
  }

  function groupEventsByMillennium(evts) {
    const groups = {};
    evts.forEach(event => {
      const year = event.is_bc ? -event.year : event.year;
      const millenniumStart = year >= 0 ? Math.floor(year / 1000) * 1000 : Math.ceil(year / 1000) * 1000;
      const key = event.is_bc ? `${Math.abs(millenniumStart)}s BC` : `${millenniumStart}s`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });
    return Object.entries(groups).map(([dateKey, evts]) => ({ dateKey, events: evts }));
  }

  function formatEventDate(event) {
    const year = event.is_bc ? `${event.year} BC` : String(event.year).padStart(4, '0');
    const month = event.month ? `-${String(event.month).padStart(2, '0')}` : '';
    const day = event.day ? `-${String(event.day).padStart(2, '0')}` : '';
    if (event.is_bc) {
      if (event.month && event.day) return `${event.year}-${month.slice(1)}-${day.slice(1)} BC`;
      if (event.month) return `${event.year}-${month.slice(1)} BC`;
      return `${event.year} BC`;
    }
    if (event.month && event.day) return `${year}${month}${day}`;
    if (event.month) return `${year}${month}`;
    return year;
  }

  function estimateDateLabelWidth(dateLabel, fontSize = 6) {
    return dateLabel.length * fontSize * 0.6;
  }

  function formatDateAtLevel(event, level) {
    const year = event.year;
    const isBC = event.is_bc;
    switch (level) {
      case 0: return formatEventDate(event);
      case 1:
        if (isBC) return event.month ? `${year}-${String(event.month).padStart(2, '0')} BC` : `${year} BC`;
        return event.month ? `${String(year).padStart(4, '0')}-${String(event.month).padStart(2, '0')}` : String(year).padStart(4, '0');
      case 2:
        return isBC ? `${year} BC` : String(year).padStart(4, '0');
      case 3: {
        const decade = Math.floor(year / 10) * 10;
        return isBC ? `${decade}s BC` : `${decade}s`;
      }
      case 4: {
        const century = Math.ceil(year / 100);
        const s = century === 1 ? 'st' : century === 2 ? 'nd' : century === 3 ? 'rd' : 'th';
        return isBC ? `${century}${s} Century BC` : `${century}${s} Century`;
      }
      case 5: {
        const millennium = Math.ceil(year / 1000);
        const s = millennium === 1 ? 'st' : millennium === 2 ? 'nd' : millennium === 3 ? 'rd' : 'th';
        return isBC ? `${millennium}${s} Millennium BC` : `${millennium}${s} Millennium`;
      }
      default: return formatEventDate(event);
    }
  }

  function formatDateRange(evts, level) {
    if (evts.length === 1) return formatDateAtLevel(evts[0], level);
    const years = evts.map(e => e.year);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const hasBC = evts.some(e => e.is_bc);
    if (minYear === maxYear) {
      if (level === 0) {
        const dates = evts.map(e => formatEventDate(e)).sort();
        return `${dates[0]} to ${dates[dates.length - 1]}`;
      }
      return formatDateAtLevel(evts[0], level);
    }
    return hasBC ? `${minYear} BC–${maxYear} BC` : `${String(minYear).padStart(4, '0')}–${String(maxYear).padStart(4, '0')}`;
  }

  function calculateRightMarginForGroups(groups) {
    if (groups.length === 0) return 100;
    const rightmostGroup = groups[groups.length - 1];
    const dateLabel = rightmostGroup.dateKey;
    const rightmostLabelWidth = estimateDateLabelWidth(dateLabel, 16);
    return Math.min(rightmostLabelWidth + 20, 100);
  }

  function applyMinimalMarkerGrouping(evts, minDate, dateRange, axisStart, axisEnd) {
    const MARKER_RADIUS = 12;
    const MIN_GAP = 27;
    const MIN_DISTANCE = (MARKER_RADIUS * 2) + MIN_GAP;
    const axisSpan = axisEnd - axisStart;

    let groups = evts.map(event => ({
      events: [event],
      avgTimestamp: getEventTimestamp(event)
    }));

    let iteration = 0;
    const maxIterations = 20;

    while (iteration < maxIterations) {
      iteration++;
      const positions = groups.map(group => {
        if (dateRange === 0) return (axisStart + axisEnd) / 2;
        return axisStart + ((group.avgTimestamp - minDate) / dateRange) * axisSpan;
      });

      const overlaps = [];
      for (let i = 1; i < groups.length; i++) {
        if (positions[i] - positions[i - 1] < MIN_DISTANCE) overlaps.push(i - 1);
      }

      if (overlaps.length === 0) {
        return groups.map((group, idx) => ({
          ...group,
          dateKey: formatEventDate(group.events[0]),
          position: positions[idx],
          hiddenLabel: false
        }));
      }

      const newGroups = [];
      let skipNext = false;
      for (let i = 0; i < groups.length; i++) {
        if (skipNext) { skipNext = false; continue; }
        if (overlaps.includes(i)) {
          const mergedEvents = [...groups[i].events, ...groups[i + 1].events];
          const mergedAvg = mergedEvents.reduce((sum, e) => sum + getEventTimestamp(e), 0) / mergedEvents.length;
          newGroups.push({ events: mergedEvents, avgTimestamp: mergedAvg });
          skipNext = true;
        } else {
          newGroups.push(groups[i]);
        }
      }
      groups = newGroups;
    }

    const positions = groups.map(group => {
      if (dateRange === 0) return (axisStart + axisEnd) / 2;
      return axisStart + ((group.avgTimestamp - minDate) / dateRange) * axisSpan;
    });
    return groups.map((group, idx) => ({
      ...group,
      dateKey: formatEventDate(group.events[0]),
      position: positions[idx],
      hiddenLabel: false
    }));
  }

  function applyRegionalDateSimplification(groups, axisStart, axisEnd) {
    if (groups.length === 0) return groups;
    const MAX_LEVEL = 5;
    const MAX_ITERATIONS = 20;

    const labelLevels = groups.map(group => {
      if (group.events.length === 1) return 0;
      const timestamps = group.events.map(e => getEventTimestamp(e));
      const spanYears = Math.max(...timestamps) - Math.min(...timestamps);
      if (spanYears < 1 / 12) return 1;
      if (spanYears < 1) return 2;
      if (spanYears < 10) return 3;
      if (spanYears < 100) return 4;
      return 5;
    });

    let iteration = 0;
    while (iteration < MAX_ITERATIONS) {
      iteration++;
      const labelData = groups.map((group, idx) => {
        const dateText = formatDateRange(group.events, labelLevels[idx]);
        const labelWidth = estimateDateLabelWidth(dateText, 16);
        return {
          index: idx,
          position: group.position,
          dateText,
          width: labelWidth,
          left: group.position - labelWidth / 2,
          right: group.position + labelWidth / 2
        };
      });

      const overlappingPairs = [];
      for (let i = 1; i < labelData.length; i++) {
        if (labelData[i].left - labelData[i - 1].right < 1) overlappingPairs.push([i - 1, i]);
      }

      if (overlappingPairs.length === 0) break;

      const alreadySimplified = new Set();
      for (const [idx1, idx2] of overlappingPairs) {
        if (alreadySimplified.has(idx1) || alreadySimplified.has(idx2)) continue;
        if (labelLevels[idx1] < MAX_LEVEL) { labelLevels[idx1]++; alreadySimplified.add(idx1); }
        if (labelLevels[idx2] < MAX_LEVEL) { labelLevels[idx2]++; alreadySimplified.add(idx2); }
      }
    }

    const formattedGroups = groups.map((group, idx) => ({
      ...group,
      dateKey: formatDateRange(group.events, labelLevels[idx]),
      formatLevel: labelLevels[idx],
      hiddenDateLabel: false
    }));

    const hiddenDuplicates = new Set();
    for (let i = 1; i < formattedGroups.length; i++) {
      if (!hiddenDuplicates.has(i - 1) && formattedGroups[i].dateKey === formattedGroups[i - 1].dateKey) {
        hiddenDuplicates.add(i);
      }
    }

    const finalHidden = new Set([...hiddenDuplicates]);
    let lastVisibleRight = -Infinity;
    const finalLabelData = formattedGroups.map((group, idx) => {
      const labelWidth = estimateDateLabelWidth(group.dateKey, 16);
      return { index: idx, left: group.position - labelWidth / 2, right: group.position + labelWidth / 2, alreadyHidden: group.hiddenDateLabel };
    });

    for (let i = 0; i < finalLabelData.length; i++) {
      if (finalLabelData[i].alreadyHidden) continue;
      if (finalLabelData[i].left - lastVisibleRight < 1 && lastVisibleRight !== -Infinity) {
        finalHidden.add(i);
      } else {
        lastVisibleRight = finalLabelData[i].right;
      }
    }

    return formattedGroups.map((group, idx) => ({ ...group, hiddenDateLabel: finalHidden.has(idx) }));
  }

  const ROTATION_ANGLE_RAD = Math.PI / 6;
  const ROTATION_SIN = Math.sin(ROTATION_ANGLE_RAD);
  const ROTATION_COS = Math.cos(ROTATION_ANGLE_RAD);

  function estimateTextWidth(text, fontSize = 14) {
    return text.length * fontSize * 0.6 * ROTATION_COS;
  }

  function estimateRotatedLabelHeight(text, fontSize = 14) {
    const baseWidth = text.length * fontSize * 0.6;
    return baseWidth * ROTATION_SIN + fontSize * ROTATION_COS + 4;
  }

  function buildLabelWithinHeight(evts, clearance, fontSize = 14) {
    if (!evts || evts.length === 0) return '';
    const names = evts.map(e => e.name || '').filter(n => n.length > 0);
    if (names.length === 0) return '';
    const visibleNames = [...names];
    let hiddenCount = 0;
    const buildCandidate = () => {
      let label = visibleNames.join(', ');
      if (hiddenCount > 0) label += `, +${hiddenCount} more`;
      return label;
    };
    while (visibleNames.length > 0) {
      const candidate = buildCandidate();
      if (estimateRotatedLabelHeight(candidate, fontSize) <= clearance) return candidate;
      if (visibleNames.length === 1) break;
      visibleNames.pop();
      hiddenCount++;
    }
    return `+${names.length} more`;
  }

  function buildLabel(evts, maxLength = 30) {
    let names = evts.map(e => e.name);
    if (names.length === 0) return '';
    let label = names[0];
    let count = 1;
    for (let i = 1; i < names.length; i++) {
      const nextLabel = label + ', ' + names[i];
      if (nextLabel.length > maxLength) break;
      label = nextLabel;
      count = i + 1;
    }
    if (count < names.length) label += `, +${names.length - count} more`;
    return label;
  }

  function expandLabelsWithAvailableSpace(processedGroups, axisStart, axisEnd, svgWidth) {
    if (processedGroups.length === 0) return processedGroups;
    const groupsWithPositions = processedGroups.map(group => {
      const avgTimestamp = group.events.reduce((sum, e) => sum + getEventTimestamp(e), 0) / group.events.length;
      let cx;
      if (currentMaxDate <= currentMinDate) {
        cx = (axisStart + axisEnd) / 2;
      } else {
        const relativePosition = (avgTimestamp - currentMinDate) / (currentMaxDate - currentMinDate);
        cx = axisStart + (relativePosition * (axisEnd - axisStart));
      }
      return { ...group, cx };
    });

    return groupsWithPositions.map((group, index) => {
      if (group.events.length <= 1 || group.hiddenLabel) return group;
      let availableWidth = svgWidth;
      const neighbors = groupsWithPositions.filter((_, i) => i !== index && !groupsWithPositions[i].hiddenLabel);
      for (const neighbor of neighbors) {
        const distance = Math.abs(neighbor.cx - group.cx);
        if (distance < 200) availableWidth = Math.min(availableWidth, distance * 1.5);
      }
      availableWidth = Math.max(availableWidth, 100);
      const fullLabel = group.events.map(e => e.name).join(', ');
      const expandedLabel = estimateTextWidth(fullLabel, 14) <= availableWidth ? fullLabel : buildLabel(group.events, 30);
      return { ...group, expandedLabel };
    });
  }

  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    let svgWidth = getContainerWidth();
    svg.setAttribute('width', svgWidth);
    svg.setAttribute('height', timelineHeight);
    svg.style.cursor = 'crosshair';

    const leftMargin = 40;
    const rightMargin = 100;
    const axisStart = leftMargin;
    const axisEnd = svgWidth - rightMargin;

    const axisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axisLine.setAttribute('x1', '0');
    axisLine.setAttribute('x2', svgWidth);
    axisLine.setAttribute('y1', axisY);
    axisLine.setAttribute('y2', axisY);
    axisLine.setAttribute('stroke', 'var(--color-gray)');
    axisLine.setAttribute('stroke-width', '2');
    axisLine.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(axisLine);

    function initializeZoomState() {
      const [minTs, maxTs] = getMinMaxTimestamps(sortedEvents);
      [originalMinDate, originalMaxDate] = addRangeMargin([minTs, maxTs], 0.05);
      currentMinDate = originalMinDate;
      currentMaxDate = originalMaxDate;
    }

    function getDateAtPixel(pixelX, aStart, aEnd) {
      const relativeX = (pixelX - aStart) / (aEnd - aStart);
      return currentMinDate + relativeX * (currentMaxDate - currentMinDate);
    }

    function calculateRightMargin(processedEvts) {
      let rightmostLabelWidth = 0;
      for (const group of processedEvts) {
        const dateLabel = formatEventDate(group.events[0]);
        const labelWidth = dateLabel.length * 6 * 0.6;
        rightmostLabelWidth = Math.max(rightmostLabelWidth, labelWidth);
      }
      return Math.min(rightmostLabelWidth, 100);
    }

    function getAxisBoundaries() {
      const lm = 40;
      const rm = calculateRightMargin(processedEvents);
      return { axisStart: lm, axisEnd: svgWidth - rm, rightMargin: rm };
    }

    function isAtZoomLimits() {
      const currentRange = currentMaxDate - currentMinDate;
      const originalRange = originalMaxDate - originalMinDate;
      const zoomRatio = originalRange / currentRange;
      const EPSILON = 0.000001;
      return { atMinZoom: zoomRatio <= 0.1 + EPSILON, atMaxZoom: zoomRatio >= 10.0 - EPSILON };
    }

    function canZoomOut() {
      if (originalMinDate == null || currentMinDate == null) return false;
      const currentRange = currentMaxDate - currentMinDate;
      const originalRange = originalMaxDate - originalMinDate;
      return currentRange + originalRange * 0.000001 < originalRange;
    }

    function canZoomIn() {
      if (originalMinDate == null || currentMinDate == null) return false;
      return !isAtZoomLimits().atMaxZoom;
    }

    function zoomOutStep() {
      if (!canZoomOut()) return;
      const originalRange = originalMaxDate - originalMinDate;
      const currentRange = currentMaxDate - currentMinDate;
      const newRange = currentRange * 1.2;
      const center = (currentMinDate + currentMaxDate) / 2;
      let newMin = center - newRange / 2;
      let newMax = center + newRange / 2;
      if (newMin < originalMinDate) newMin = originalMinDate;
      if (newMax > originalMaxDate) newMax = originalMaxDate;
      const EPSILON = originalRange * 0.000001;
      if (Math.abs((newMax - newMin) - originalRange) <= EPSILON) {
        newMin = originalMinDate;
        newMax = originalMaxDate;
      }
      currentMinDate = newMin;
      currentMaxDate = newMax;
      updateTimelineDisplay();
    }

    function zoomInStep() {
      if (!canZoomIn()) return;
      if (!Number.isFinite(currentMinDate) || !Number.isFinite(currentMaxDate)) return;
      const originalRange = originalMaxDate - originalMinDate;
      const currentRange = currentMaxDate - currentMinDate;
      if (!Number.isFinite(currentRange) || currentRange <= 0) return;
      const newRange = currentRange * 0.8;
      const center = (currentMinDate + currentMaxDate) / 2;
      let newMin = center - newRange / 2;
      let newMax = center + newRange / 2;
      const [eventMinTs, eventMaxTs] = getMinMaxTimestamps(sortedEvents);
      newMin = Math.max(newMin, eventMinTs);
      newMax = Math.min(newMax, eventMaxTs);
      const minRange = originalRange * 0.1;
      if (newMax - newMin < minRange) {
        newMin = center - minRange / 2;
        newMax = center + minRange / 2;
      }
      currentMinDate = newMin;
      currentMaxDate = newMax;
      updateTimelineDisplay();
    }

    initializeZoomState();
    const dateRange = currentMaxDate - currentMinDate;

    let processedEvents = applyMinimalMarkerGrouping(sortedEvents, currentMinDate, dateRange, axisStart, axisEnd);
    processedEvents = applyRegionalDateSimplification(processedEvents, axisStart, axisEnd);
    processedEvents = expandLabelsWithAvailableSpace(processedEvents, axisStart, axisEnd, svgWidth);

    const visibleProcessedEvents = processedEvents.filter(group => {
      const avgTimestamp = group.events.reduce((sum, e) => sum + getEventTimestamp(e), 0) / group.events.length;
      return avgTimestamp >= currentMinDate && avgTimestamp <= currentMaxDate;
    });

    const axisSpan = axisEnd - axisStart;
    visibleProcessedEvents.forEach(group => {
      const avgTimestamp = group.events.reduce((sum, e) => sum + getEventTimestamp(e), 0) / group.events.length;
      let cx;
      if (currentMaxDate === currentMinDate) {
        cx = (axisStart + axisEnd) / 2;
      } else {
        cx = axisStart + ((avgTimestamp - currentMinDate) / (currentMaxDate - currentMinDate)) * axisSpan;
      }
      renderEventMarker(svg, group, cx, axisY, { buildLabelWithinHeight, buildLabel });
    });

    container.appendChild(svg);

    const emptySelectionMessage = document.createElement('div');
    emptySelectionMessage.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:12px 16px;border-radius:10px;background:rgba(255,255,255,0.9);border:1px solid rgba(0,0,0,0.08);color:var(--color-dark);font-family:var(--font-body);font-size:14px;text-align:center;pointer-events:none;display:none;';
    emptySelectionMessage.textContent = 'No events in current view. Zoom out or reset.';
    container.appendChild(emptySelectionMessage);

    // Keyboard panning
    if (window.__timelineKeyboardPanHandler) {
      window.removeEventListener('keydown', window.__timelineKeyboardPanHandler);
      window.__timelineKeyboardPanHandler = null;
    }

    function clampPanRange(newMin, newMax, minStop, maxStop) {
      const windowSize = newMax - newMin;
      const stopSize = maxStop - minStop;
      if (!Number.isFinite(windowSize) || windowSize <= 0) return null;
      if (!Number.isFinite(stopSize) || stopSize <= 0) return null;
      if (windowSize >= stopSize) return { min: minStop, max: maxStop, didClamp: true };
      let clampedMin = newMin;
      let clampedMax = newMax;
      if (clampedMin < minStop) { clampedMin = minStop; clampedMax = minStop + windowSize; }
      if (clampedMax > maxStop) { clampedMax = maxStop; clampedMin = maxStop - windowSize; }
      return { min: clampedMin, max: clampedMax, didClamp: clampedMin !== newMin || clampedMax !== newMax };
    }

    function isCurrentlyZoomToFit() {
      if (!Number.isFinite(currentMinDate) || !Number.isFinite(originalMinDate)) return true;
      const EPSILON = 1 / 365;
      return Math.abs(currentMinDate - originalMinDate) < EPSILON && Math.abs(currentMaxDate - originalMaxDate) < EPSILON;
    }

    function handleKeyboardShortcuts(e) {
      if (!isTimelineActive || isSelecting) return;
      try {
        const target = e.target;
        if (target && typeof target.closest === 'function') {
          if (target.closest('input, textarea, select, [contenteditable]')) return;
        }
      } catch {}

      if (e.key === '0') {
        e.preventDefault();
        currentMinDate = originalMinDate;
        currentMaxDate = originalMaxDate;
        updateTimelineDisplay();
        return;
      }
      if (e.key === '-') { e.preventDefault(); zoomOutStep(); return; }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomInStep(); return; }

      const isLeft = e.key === 'ArrowLeft';
      const isRight = e.key === 'ArrowRight';
      if (!isLeft && !isRight) return;
      if (isCurrentlyZoomToFit()) return;
      if (!Number.isFinite(currentMinDate)) return;

      const windowSize = currentMaxDate - currentMinDate;
      if (!Number.isFinite(windowSize) || windowSize <= 0) return;

      const stepFraction = e.shiftKey ? 0.25 : 0.10;
      const delta = (isLeft ? -1 : 1) * windowSize * stepFraction;
      const [rawMin, rawMax] = getMinMaxTimestamps(sortedEvents);
      const [minStop, maxStop] = addRangeMargin([rawMin, rawMax], 0.05);
      const clamped = clampPanRange(currentMinDate + delta, currentMaxDate + delta, minStop, maxStop);
      if (!clamped) return;
      e.preventDefault();
      currentMinDate = clamped.min;
      currentMaxDate = clamped.max;
      updateTimelineDisplay();
    }

    window.__timelineKeyboardPanHandler = handleKeyboardShortcuts;
    window.addEventListener('keydown', window.__timelineKeyboardPanHandler);

    function updateTimelineDisplay() {
      const { axisStart: uStart, axisEnd: uEnd } = getAxisBoundaries();
      const dRange = currentMaxDate - currentMinDate;

      let pEvents = applyMinimalMarkerGrouping(sortedEvents, currentMinDate, dRange, uStart, uEnd);
      pEvents = applyRegionalDateSimplification(pEvents, uStart, uEnd);
      pEvents = expandLabelsWithAvailableSpace(pEvents, uStart, uEnd, svgWidth);

      const visiblePEvents = pEvents.filter(group => {
        const avg = group.events.reduce((sum, e) => sum + getEventTimestamp(e), 0) / group.events.length;
        return avg >= currentMinDate && avg <= currentMaxDate;
      });

      if (sortedEvents.length > 0 && visiblePEvents.length === 0) {
        emptySelectionMessage.style.display = 'block';
      } else {
        emptySelectionMessage.style.display = 'none';
      }

      const currentSvg = container.querySelector('svg');
      currentSvg.querySelectorAll('circle, text:not(.axis-label)').forEach(el => el.remove());

      const span = uEnd - uStart;
      visiblePEvents.forEach(group => {
        const avg = group.events.reduce((sum, e) => sum + getEventTimestamp(e), 0) / group.events.length;
        const relPos = (avg - currentMinDate) / dRange;
        const cx = uStart + relPos * span;
        renderEventMarker(currentSvg, group, cx, axisY, { buildLabelWithinHeight, buildLabel });
      });

      updateZoomButtonStates();
    }

    // Zoom controls
    let zoomControls = null;
    let zoomToFitBtn = null;
    let zoomInBtn = null;
    let zoomOutBtn = null;
    let panLeftBigBtn = null;
    let panLeftBtn = null;
    let panRightBtn = null;
    let panRightBigBtn = null;

    function updateZoomButtonStates() {
      if (!zoomOutBtn || !zoomInBtn) return;
      zoomInBtn.style.display = canZoomIn() ? 'inline-flex' : 'none';
      zoomOutBtn.style.display = canZoomOut() ? 'inline-flex' : 'none';
      const showPan = !isCurrentlyZoomToFit();
      [panLeftBigBtn, panLeftBtn, panRightBtn, panRightBigBtn].forEach(btn => {
        if (btn) btn.style.display = showPan ? 'inline-flex' : 'none';
      });
    }

    const controlsWrapper = document.createElement('div');
    controlsWrapper.style.position = 'relative';

    const hoverBridge = document.createElement('div');
    hoverBridge.style.cssText = 'position:absolute;top:-12px;left:0;right:0;height:12px;background:transparent;pointer-events:auto;';

    zoomControls = document.createElement('div');
    zoomControls.className = 'timeline-controls';
    zoomControls.style.cssText = 'display:flex;gap:8px;padding-top:12px;justify-content:center;';

    controlsWrapper.appendChild(hoverBridge);
    controlsWrapper.appendChild(zoomControls);

    function makeBtn(text, keycap) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tl-btn';
      btn.textContent = text;
      if (keycap) {
        const kc = document.createElement('span');
        kc.className = 'tl-keycap';
        kc.textContent = keycap;
        btn.appendChild(kc);
      }
      return btn;
    }

    zoomToFitBtn = makeBtn('Zoom to Fit', '0');
    zoomInBtn = makeBtn('Zoom in', '+');
    zoomInBtn.style.display = 'none';
    zoomOutBtn = makeBtn('Zoom out', '−');
    zoomOutBtn.style.display = 'none';
    panLeftBigBtn = makeBtn('◀◀', '⇧←');
    panLeftBigBtn.style.display = 'none';
    panLeftBtn = makeBtn('◀', '←');
    panLeftBtn.style.display = 'none';
    panRightBtn = makeBtn('▶', '→');
    panRightBtn.style.display = 'none';
    panRightBigBtn = makeBtn('▶▶', '⇧→');
    panRightBigBtn.style.display = 'none';

    function panByFraction(stepFraction, direction) {
      if (isSelecting || isCurrentlyZoomToFit()) return;
      if (!Number.isFinite(currentMinDate)) return;
      const windowSize = currentMaxDate - currentMinDate;
      if (!Number.isFinite(windowSize) || windowSize <= 0) return;
      const delta = direction * windowSize * stepFraction;
      const [rawMin, rawMax] = getMinMaxTimestamps(sortedEvents);
      const [minStop, maxStop] = addRangeMargin([rawMin, rawMax], 0.05);
      const clamped = clampPanRange(currentMinDate + delta, currentMaxDate + delta, minStop, maxStop);
      if (!clamped) return;
      currentMinDate = clamped.min;
      currentMaxDate = clamped.max;
      updateTimelineDisplay();
    }

    zoomToFitBtn.addEventListener('click', () => {
      currentMinDate = originalMinDate;
      currentMaxDate = originalMaxDate;
      updateTimelineDisplay();
    });
    zoomOutBtn.addEventListener('click', zoomOutStep);
    zoomInBtn.addEventListener('click', zoomInStep);
    panLeftBigBtn.addEventListener('click', () => panByFraction(0.25, -1));
    panLeftBtn.addEventListener('click', () => panByFraction(0.10, -1));
    panRightBtn.addEventListener('click', () => panByFraction(0.10, 1));
    panRightBigBtn.addEventListener('click', () => panByFraction(0.25, 1));

    [panLeftBigBtn, panLeftBtn, zoomInBtn, zoomToFitBtn, zoomOutBtn, panRightBtn, panRightBigBtn].forEach(btn => {
      zoomControls.appendChild(btn);
    });

    function updateControlsActivationUI() { /* controls always visible */ }

    // Drag-to-zoom selection
    svg.addEventListener('mousedown', function (e) {
      const rect = svg.getBoundingClientRect();
      const svgX = e.clientX - rect.left;
      const { axisStart: aS, axisEnd: aE } = getAxisBoundaries();
      if (svgX < aS || svgX > aE) return;
      isSelecting = true;
      selectionStartX = svgX;
      selectionStartDate = getDateAtPixel(svgX, aS, aE);
      selectionRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      selectionRect.setAttribute('fill', 'rgba(100,120,200,0.2)');
      selectionRect.setAttribute('stroke', 'rgba(100,120,200,0.5)');
      selectionRect.setAttribute('stroke-width', '1');
      selectionRect.setAttribute('pointer-events', 'none');
      selectionRect.setAttribute('x', svgX);
      selectionRect.setAttribute('y', 0);
      selectionRect.setAttribute('width', 0);
      selectionRect.setAttribute('height', timelineHeight);
      svg.insertBefore(selectionRect, svg.firstChild);
      e.preventDefault();
    });

    svg.addEventListener('mousemove', function (e) {
      if (!isSelecting || !selectionRect) return;
      const rect = svg.getBoundingClientRect();
      const svgX = e.clientX - rect.left;
      const { axisStart: aS, axisEnd: aE } = getAxisBoundaries();
      const clampedX = Math.max(aS, Math.min(aE, svgX));
      const startX = Math.min(selectionStartX, clampedX);
      const endX = Math.max(selectionStartX, clampedX);
      selectionRect.setAttribute('x', startX);
      selectionRect.setAttribute('width', endX - startX);
    });

    svg.addEventListener('mouseup', function (e) {
      if (!isSelecting || !selectionRect) return;
      const rect = svg.getBoundingClientRect();
      const svgX = e.clientX - rect.left;
      const { axisStart: aS, axisEnd: aE } = getAxisBoundaries();
      const clampedX = Math.max(aS, Math.min(aE, svgX));
      const dragDistance = Math.abs(clampedX - selectionStartX);
      if (dragDistance >= 10) {
        currentMinDate = getDateAtPixel(Math.min(selectionStartX, clampedX), aS, aE);
        currentMaxDate = getDateAtPixel(Math.max(selectionStartX, clampedX), aS, aE);
        updateTimelineDisplay();
      }
      if (selectionRect) { svg.removeChild(selectionRect); selectionRect = null; }
      isSelecting = false;
      selectionStartX = null;
      selectionStartDate = null;
    });

    updateZoomButtonStates();
    container.appendChild(controlsWrapper);

    // Allow external update with preserved zoom
    container.updateEvents = function (newEvents) {
      const EPSILON = 1 / 365;
      const isZoomToFit = (
        Math.abs(currentMinDate - originalMinDate) < EPSILON &&
        Math.abs(currentMaxDate - originalMaxDate) < EPSILON
      );
      const preservedMin = currentMinDate;
      const preservedMax = currentMaxDate;

      // Sort from newEvents directly — do NOT mutate the passed-in array
      // (it may be the same reference as the caller's source array)
      sortedEvents = newEvents.slice().sort((a, b) => getEventTimestamp(a) - getEventTimestamp(b));

      if (sortedEvents.length > 0) {
        const [minTs, maxTs] = getMinMaxTimestamps(sortedEvents);
        [originalMinDate, originalMaxDate] = addRangeMargin([minTs, maxTs], 0.05);
        currentMinDate = isZoomToFit ? originalMinDate : preservedMin;
        currentMaxDate = isZoomToFit ? originalMaxDate : preservedMax;
      }
      updateTimelineDisplay();
    };

    container.classList.add('timeline-component');

    // Resize handler
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        svgWidth = getContainerWidth();
        svg.setAttribute('width', svgWidth);
        axisLine.setAttribute('x2', svgWidth);
        updateTimelineDisplay();
      }, 75);
    });

    return container;

  } catch (err) {
    console.error('Timeline rendering error:', err);
    container.textContent = 'Something went wrong rendering the timeline.';
  }

  return container;
};

function renderEventMarker(svg, group, cx, axisY, options = {}) {
  const { buildLabelWithinHeight: heightBuilder, buildLabel: fallbackLabel } = options;

  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  marker.setAttribute('cx', cx);
  marker.setAttribute('cy', axisY);
  marker.setAttribute('r', '12');
  marker.setAttribute('fill', 'var(--color-accent)');
  marker.setAttribute('stroke', 'var(--color-accent-border)');
  marker.setAttribute('stroke-width', '2');
  marker.style.cursor = 'pointer';
  svg.appendChild(marker);

  if (group.events.length > 1) {
    const countText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    countText.setAttribute('x', cx);
    countText.setAttribute('y', axisY + 5);
    countText.setAttribute('text-anchor', 'middle');
    countText.setAttribute('font-size', '11px');
    countText.setAttribute('font-family', 'var(--font-body)');
    countText.setAttribute('fill', '#fff');
    countText.setAttribute('pointer-events', 'none');
    countText.textContent = group.events.length;
    svg.appendChild(countText);
  }

  if (!group.hiddenLabel) {
    const clearance = Math.max(0, axisY - 18);
    const eventName = heightBuilder
      ? heightBuilder(group.events, clearance, 13)
      : (fallbackLabel ? fallbackLabel(group.events, 30) : '');
    if (eventName) {
      const nameLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      nameLabel.setAttribute('x', cx);
      nameLabel.setAttribute('y', axisY - 18);
      nameLabel.setAttribute('text-anchor', 'start');
      nameLabel.setAttribute('font-size', '13px');
      nameLabel.setAttribute('fill', 'var(--color-dark)');
      nameLabel.setAttribute('font-family', 'var(--font-body)');
      nameLabel.setAttribute('pointer-events', 'none');
      nameLabel.setAttribute('transform', `rotate(-30 ${cx} ${axisY - 18})`);
      nameLabel.textContent = eventName;
      svg.appendChild(nameLabel);
    }
  }

  if (!group.hiddenDateLabel) {
    const dateLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    dateLabel.setAttribute('x', cx);
    dateLabel.setAttribute('y', axisY + 28);
    dateLabel.setAttribute('text-anchor', 'middle');
    dateLabel.setAttribute('font-size', '11px');
    dateLabel.setAttribute('fill', 'var(--color-muted)');
    dateLabel.setAttribute('font-family', 'var(--font-body)');
    dateLabel.setAttribute('pointer-events', 'none');
    dateLabel.textContent = group.dateKey;
    svg.appendChild(dateLabel);
  }
}

window.Timeline = Timeline;
