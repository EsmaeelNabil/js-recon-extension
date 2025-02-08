// Search functionality
let currentMatchIndex = -1;
let matches = [];

// Shared utility functions
function updateNavigationButtons() {
  const prevButton = document.getElementById("prevMatch");
  const nextButton = document.getElementById("nextMatch");

  prevButton.disabled = matches.length === 0;
  nextButton.disabled = matches.length === 0;
}

function performSearch(searchText) {
  clearHighlights();
  matches = [];
  currentMatchIndex = -1;
  updateNavigationButtons();

  if (!searchText) {
    updateSearchInfo();
    return;
  }

  const codeContent = document.querySelector(".code-content");
  const text = codeContent.textContent;
  const regex = new RegExp(escapeRegExp(searchText), "gi");
  let match;

  while ((match = regex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
    });
  }

  if (matches.length > 0) {
    currentMatchIndex = 0;
    highlightMatches();
  }
  updateSearchInfo();
  updateNavigationButtons();
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clearHighlights() {
  const codeContent = document.querySelector(".code-content");
  codeContent.innerHTML = codeContent.textContent;
}

function highlightMatches() {
  if (matches.length === 0 || currentMatchIndex < 0) return;

  const match = matches[currentMatchIndex];
  const codeContent = document.querySelector(".code-content");
  const text = codeContent.textContent;

  const before = text.substring(0, match.index);
  const matchText = text.substring(match.index, match.index + match.length);
  const after = text.substring(match.index + match.length);

  codeContent.innerHTML =
    escapeHtml(before) +
    `<span class="highlight">${escapeHtml(matchText)}</span>` +
    escapeHtml(after);

  // Scroll the highlighted text into view
  const highlight = codeContent.querySelector(".highlight");
  if (highlight) {
    highlight.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function updateSearchInfo() {
  const info = document.getElementById("searchInfo");
  if (matches.length > 0) {
    info.textContent = `${currentMatchIndex + 1} of ${matches.length} matches`;
  } else {
    info.textContent = "No matches found";
  }
}

function nextMatch() {
  if (matches.length > 0) {
    currentMatchIndex = (currentMatchIndex + 1) % matches.length;
    clearHighlights();
    highlightMatches();
    updateSearchInfo();
  }
}

function previousMatch() {
  if (matches.length > 0) {
    currentMatchIndex =
      (currentMatchIndex - 1 + matches.length) % matches.length;
    clearHighlights();
    highlightMatches();
    updateSearchInfo();
  }
}

function updateLineNumbers() {
  const codeContent = document.querySelector(".code-content");
  const lineNumbers = document.querySelector(".line-numbers");
  if (!codeContent || !lineNumbers) return;

  const lines = codeContent.textContent.split("\n").length;
  lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => i + 1)
    .map((num) => `<div>${num}</div>`)
    .join("");
}

// Export the functions
window.codeViewerUtils = {
  updateNavigationButtons,
  performSearch,
  clearHighlights,
  nextMatch,
  previousMatch,
  updateLineNumbers,
};
