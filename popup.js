document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadPatterns();

    chrome.storage.local.get("pageContent", (result) => {
      if (chrome.runtime.lastError || !result.pageContent) {
        document.getElementById("codeContainer").innerHTML =
          "<p>Error: No page content available. Did you click the extension on a page?</p>";
        return;
      }
      const pageContent = result.pageContent;
      const scriptContents = extractJavaScriptFromHTML(pageContent);
      if (scriptContents && scriptContents.length > 0) {
        displayCode(scriptContents);
      } else {
        document.getElementById("codeContainer").innerHTML =
          "<p>No JavaScript code found in the page content.</p>";
      }
    });

    // Set up search functionality
    const searchInput = document.getElementById("searchInput");
    const prevButton = document.getElementById("prevMatch");
    const nextButton = document.getElementById("nextMatch");

    searchInput.addEventListener("input", (e) => {
      performSearch(e.target.value);
    });
    prevButton.addEventListener("click", previousMatch);
    nextButton.addEventListener("click", nextMatch);

    // Set up export functionality
    document
      .getElementById("exportAll")
      .addEventListener("click", () => exportCode(true));

    // Initialize pattern form
    setupPatternForm();
  } catch (error) {
    console.error("Error initializing viewer:", error);
    document.getElementById("codeContainer").innerHTML =
      "<p>Error: An unexpected error occurred while initializing the app.</p>";
  }
});

// Function to extract JavaScript code from the page
function extractJavaScript() {
  const scripts = Array.from(document.getElementsByTagName("script"));
  const scriptContents = [];
  // Ignore any scripts that are inside our extension modal.
  scripts.forEach((script) => {
    if (script.closest("#code-viewer-modal")) return;
    if (script.textContent.trim()) {
      scriptContents.push({
        type: "Inline Script",
        content: script.textContent.trim(),
      });
    }
    if (script.src) {
      scriptContents.push({
        type: "External Script",
        source: script.src,
      });
    }
  });
  return scriptContents;
}

// Simple code prettifier
function prettifyCode(code) {
  try {
    // Basic indentation for brackets
    let formatted = "";
    let indent = 0;
    const lines = code.split(/\n/);

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // Decrease indent for closing brackets at start of line
      if (
        line.startsWith("}") ||
        line.startsWith("]") ||
        line.startsWith(")")
      ) {
        indent = Math.max(0, indent - 1);
      }

      // Add indentation
      formatted += "  ".repeat(indent) + line + "\n";

      // Increase indent for opening brackets at end of line
      if (line.endsWith("{") || line.endsWith("[") || line.endsWith("(")) {
        indent++;
      }
      // Decrease indent for closing brackets at end of line
      else if (line.endsWith("}") || line.endsWith("]") || line.endsWith(")")) {
        indent = Math.max(0, indent - 1);
      }
    }
    return formatted;
  } catch (error) {
    console.error("Error prettifying code:", error);
    return code; // Return original code if prettifying fails
  }
}

// Search functionality
let currentMatchIndex = -1;
let matches = [];

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

// Export functionality
function exportCode(allScripts = true) {
  try {
    const codeContent = document.querySelector(".code-content");
    if (!codeContent) {
      console.log("No code content found to export");
      return;
    }

    const content = codeContent.textContent;
    const blob = new Blob([content], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scripts.js";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error exporting code:", error);
  }
}

// Function to update line numbers
function updateLineNumbers() {
  const codeContent = document.querySelector(".code-content");
  const lineNumbers = document.querySelector(".line-numbers");
  const lines = codeContent.textContent.split("\n").length;

  lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => i + 1)
    .map((num) => `<div>${num}</div>`)
    .join("");
}

// Security patterns
const defaultPatterns = [
  {
    name: "API Keys",
    type: "regex",
    pattern:
      /['"]?[a-zA-Z0-9_-]+(?:api|key|token|secret|password|pwd|auth)['"]?\s*[=:]\s*['"][a-zA-Z0-9_\-\.]+['"]/gi,
    enabled: true,
  },
  {
    name: "JWT Tokens",
    type: "regex",
    pattern: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    enabled: true,
  },
  {
    name: "AWS Access Keys",
    type: "regex",
    pattern: /AKIA[0-9A-Z]{16}/g,
    enabled: true,
  },
  {
    name: "AWS Secret Keys",
    type: "regex",
    pattern: /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/g,
    enabled: true,
  },
  {
    name: "Google API Keys",
    type: "regex",
    pattern: /AIza[0-9A-Za-z-_]{35}/g,
    enabled: true,
  },
  {
    name: "Slack Tokens",
    type: "regex",
    pattern: /xox[baprs]-[0-9a-zA-Z]{10,48}/g,
    enabled: true,
  },
  {
    name: "Stripe API Keys (Live)",
    type: "regex",
    pattern: /sk_live_[0-9a-zA-Z]{24}/g,
    enabled: true,
  },
  {
    name: "Stripe API Keys (Test)",
    type: "regex",
    pattern: /sk_test_[0-9a-zA-Z]{24}/g,
    enabled: true,
  },
  {
    name: "GitHub Tokens",
    type: "regex",
    pattern: /ghp_[0-9A-Za-z]{36}/g,
    enabled: true,
  },
  {
    name: "Private Keys (PEM)",
    type: "regex",
    pattern:
      /-----BEGIN (?:RSA|DSA|EC|OPENSSH) PRIVATE KEY-----[\s\S]+?-----END (?:RSA|DSA|EC|OPENSSH) PRIVATE KEY-----/g,
    enabled: true,
  },
  {
    name: "Database Connection Strings (MongoDB)",
    type: "regex",
    pattern: /mongodb(?:\+srv)?:\/\/[^\s'"]+/g,
    enabled: true,
  },
  {
    name: "Database Connection Strings (MySQL)",
    type: "regex",
    pattern: /mysql:\/\/[^\s'"]+/g,
    enabled: true,
  },
  {
    name: "Database Connection Strings (PostgreSQL)",
    type: "regex",
    pattern: /postgres(?:ql)?:\/\/[^\s'"]+/g,
    enabled: true,
  },
  {
    name: "OAuth Client Secrets",
    type: "keyword",
    keywords: ["client_secret", "oauth_secret"],
    enabled: true,
  },
  {
    name: "Common Secrets",
    type: "keyword",
    keywords: [
      "api_key",
      "apikey",
      "token",
      "secret",
      "password",
      "credentials",
      "auth_token",
    ],
    enabled: true,
  },
  {
    name: "Environment Variables",
    type: "regex",
    pattern: /process\.env\.[A-Z_]+/g,
    enabled: true,
  },
  {
    name: "Inline HTML Secrets",
    type: "regex",
    pattern:
      /<!--[\s\S]*?(?:api_key|apikey|token|secret|password)[\s\S]*?-->/gi,
    enabled: true,
  },
  {
    name: "SSL Certificates",
    type: "regex",
    pattern: /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,
    enabled: true,
  },
  {
    name: "SMTP Credentials",
    type: "regex",
    pattern: /smtp:\/\/[^\s'"]+/g,
    enabled: true,
  },
  {
    name: "Bitbucket Tokens",
    type: "regex",
    pattern: /bbt_[0-9a-zA-Z]{20,40}/g,
    enabled: true,
  },
  // Additional patterns
  {
    name: "Azure Storage Keys",
    type: "regex",
    pattern:
      /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[^;]+;/g,
    enabled: true,
  },
  {
    name: "Twilio Account SID",
    type: "regex",
    pattern: /AC[0-9a-fA-F]{32}/g,
    enabled: true,
  },
  {
    name: "Twilio Auth Token",
    type: "regex",
    pattern: /[0-9a-fA-F]{32}/g,
    enabled: true,
  },
  {
    name: "Redis Connection Strings",
    type: "regex",
    pattern: /redis:\/\/[^\s'"]+/g,
    enabled: true,
  },
  {
    name: "Redis Password in URL",
    type: "regex",
    pattern: /redis:\/\/:[^@]+@/g,
    enabled: true,
  },
  {
    name: "SAML Response",
    type: "regex",
    pattern: /<samlp:Response[\s\S]+<\/samlp:Response>/g,
    enabled: true,
  },
  {
    name: "Cookie Secrets",
    type: "regex",
    pattern: /cookie_secret\s*[=:]\s*['"][^'"]+['"]/gi,
    enabled: true,
  },
  {
    name: "GCP Service Account Keys",
    type: "regex",
    pattern:
      /"type":\s*"service_account".+?"private_key":\s*"-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----"/g,
    enabled: true,
  },
  {
    name: "DigitalOcean API Token",
    type: "regex",
    pattern: /do-[0-9a-fA-F]{64}/g,
    enabled: true,
  },
  {
    name: "Heroku API Key",
    type: "regex",
    pattern: /heroku[a-zA-Z0-9]{30,}/g,
    enabled: true,
  },
  {
    name: "SendGrid API Key",
    type: "regex",
    pattern: /SG\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    enabled: true,
  },
  {
    name: "Firebase Database Secret",
    type: "regex",
    pattern: /["']?firebase_secret["']?\s*[:=]\s*["'][A-Za-z0-9_\-]{40,}["']/g,
    enabled: true,
  },
  {
    name: "Mailgun API Key",
    type: "regex",
    pattern: /key-[0-9a-fA-F]{32}/g,
    enabled: true,
  },
  {
    name: "Pusher App Key",
    type: "regex",
    pattern: /[Pp]usher\s*app\s*key\s*[:=]\s*["'][A-Za-z0-9]+["']/g,
    enabled: true,
  },
  {
    name: "Vercel Token",
    type: "regex",
    pattern: /vercel\s*token\s*[:=]\s*["'][A-Za-z0-9_\-]{20,}["']/g,
    enabled: true,
  },
  {
    name: "Netlify Token",
    type: "regex",
    pattern: /netlify\s*token\s*[:=]\s*["'][A-Za-z0-9_\-]{20,}["']/g,
    enabled: true,
  },
  {
    name: "Bitly Generic Access Token",
    type: "regex",
    pattern: /bitly\s*access\s*token\s*[:=]\s*["'][A-Za-z0-9_\-]{20,}["']/g,
    enabled: true,
  },
  {
    name: "Cloudinary API Key",
    type: "regex",
    pattern: /cloudinary\s*api\s*key\s*[:=]\s*["'][A-Za-z0-9]+["']/g,
    enabled: true,
  },
  {
    name: "Cloudinary API Secret",
    type: "regex",
    pattern: /cloudinary\s*api\s*secret\s*[:=]\s*["'][A-Za-z0-9_\-]+["']/g,
    enabled: true,
  },
  {
    name: "Amazon S3 Bucket URL",
    type: "regex",
    pattern: /https?:\/\/[a-z0-9.-]+\.s3\.amazonaws\.com\/[^\s'"]+/gi,
    enabled: true,
  },
  {
    name: "GCP Storage URL",
    type: "regex",
    pattern: /https?:\/\/storage\.googleapis\.com\/[^\s'"]+/gi,
    enabled: true,
  },
  {
    name: "DigitalOcean Spaces URL",
    type: "regex",
    pattern: /https?:\/\/[^\s'"]+\.digitaloceanspaces\.com\/[^\s'"]+/gi,
    enabled: true,
  },
  {
    name: "Bearer Token",
    type: "regex",
    pattern: /Bearer\s+[A-Za-z0-9\-_\.]+/g,
    enabled: true,
  },
];

// Load patterns from storage or use defaults
let securityPatterns = [];

// Function to load patterns from storage
async function loadPatterns() {
  try {
    if (!chrome.storage || !chrome.storage.sync) {
      console.warn("Chrome storage not available, using default patterns");
      securityPatterns = [...defaultPatterns];
      return;
    }

    const result = await chrome.storage.sync.get("securityPatterns");
    if (result && result.securityPatterns) {
      // Convert stored pattern strings back to RegExp objects
      securityPatterns = result.securityPatterns
        .map((pattern) => {
          if (pattern.type === "regex" && typeof pattern.pattern === "string") {
            try {
              const match = pattern.pattern.match(/^\/(.+)\/([gimuy]*)$/);
              if (match) {
                pattern.pattern = new RegExp(match[1], match[2]);
              }
            } catch (error) {
              console.error("Error parsing regex pattern:", error);
              return null;
            }
          }
          return pattern;
        })
        .filter(Boolean); // Remove any null patterns
    } else {
      securityPatterns = [...defaultPatterns];
      await savePatterns();
    }
  } catch (error) {
    console.error("Error loading patterns:", error);
    securityPatterns = [...defaultPatterns];
  }
}

// Function to save patterns to storage
async function savePatterns() {
  try {
    if (!chrome.storage || !chrome.storage.sync) {
      console.warn("Chrome storage not available, patterns will not persist");
      return;
    }

    // Convert RegExp objects to strings for storage
    const patternsToSave = securityPatterns.map((pattern) => ({
      ...pattern,
      pattern:
        pattern.type === "regex" ? pattern.pattern.toString() : pattern.pattern,
    }));
    await chrome.storage.sync.set({ securityPatterns: patternsToSave });
  } catch (error) {
    console.error("Error saving patterns:", error);
  }
}

// Function to scan code for security patterns
function scanForSecurityIssues(code) {
  const findings = [];

  securityPatterns.forEach((pattern) => {
    if (!pattern.enabled) {
      findings.push({
        name: pattern.name,
        matches: [],
        enabled: false,
      });
      return;
    }

    if (pattern.type === "regex") {
      const matches = [...code.matchAll(pattern.pattern)];
      findings.push({
        name: pattern.name,
        matches: matches.map((match) => ({
          text: match[0],
          index: match.index,
        })),
        enabled: true,
      });
    } else if (pattern.type === "keyword") {
      const matches = [];
      pattern.keywords.forEach((keyword) => {
        const regex = new RegExp(keyword, "gi");
        let match;
        while ((match = regex.exec(code)) !== null) {
          matches.push({
            text: match[0],
            index: match.index,
          });
        }
      });
      findings.push({
        name: pattern.name,
        matches,
        enabled: true,
      });
    }
  });

  return findings;
}

// Function to display findings
function displayFindings(findings) {
  const container = document.getElementById("findingsContent");
  container.innerHTML = "";

  findings.forEach((group) => {
    const groupElement = document.createElement("div");
    groupElement.className = `mb-4 ${
      !group.enabled || group.matches.length === 0
        ? "opacity-50"
        : "opacity-100"
    } transition-opacity duration-200`;

    const titleElement = document.createElement("div");
    titleElement.className =
      "font-bold text-gray-600 mb-2 flex justify-between items-center";

    const headerElement = document.createElement("div");
    headerElement.className = "flex justify-between items-center w-full";

    const titleTextElement = document.createElement("span");
    titleTextElement.textContent = group.name;

    const matchCountElement = document.createElement("span");
    matchCountElement.className =
      "bg-primary text-white px-1.5 py-0.5 rounded-full text-xs";
    matchCountElement.textContent = group.matches.length;

    headerElement.appendChild(titleTextElement);
    headerElement.appendChild(matchCountElement);

    const controlsElement = document.createElement("div");
    controlsElement.className = "flex gap-1";

    // Toggle button
    const toggleBtn = document.createElement("button");
    toggleBtn.className =
      "bg-transparent border-none text-gray-500 hover:text-gray-700 cursor-pointer p-0.5 text-xs";
    toggleBtn.innerHTML = group.enabled ? "☑" : "☐";
    toggleBtn.title = group.enabled ? "Disable" : "Enable";
    toggleBtn.addEventListener("click", async () => {
      const pattern = securityPatterns.find((p) => p.name === group.name);
      if (pattern) {
        pattern.enabled = !pattern.enabled;
        await savePatterns();
        const codeContent = document.querySelector(".code-content");
        if (codeContent) {
          const findings = scanForSecurityIssues(codeContent.textContent);
          displayFindings(findings);
        }
      }
    });

    // Edit button
    const editBtn = document.createElement("button");
    editBtn.className =
      "bg-transparent border-none text-gray-500 hover:text-gray-700 cursor-pointer p-0.5 text-xs";
    editBtn.innerHTML = "✎";
    editBtn.title = "Edit";
    editBtn.addEventListener("click", () => {
      const pattern = securityPatterns.find((p) => p.name === group.name);
      if (pattern) {
        document.getElementById("patternName").value = pattern.name;
        document.getElementById("patternType").value = pattern.type;
        document.getElementById("patternValue").value =
          pattern.type === "regex"
            ? pattern.pattern.source
            : pattern.keywords.join(", ");
        document.querySelector(".pattern-form").classList.remove("hidden");

        // Remove the old pattern when editing
        securityPatterns = securityPatterns.filter(
          (p) => p.name !== pattern.name,
        );
      }
    });

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.className =
      "bg-transparent border-none text-gray-500 hover:text-gray-700 cursor-pointer p-0.5 text-xs";
    deleteBtn.innerHTML = "🗑";
    deleteBtn.title = "Delete";
    deleteBtn.addEventListener("click", async () => {
      if (
        confirm(`Are you sure you want to delete the "${group.name}" pattern?`)
      ) {
        securityPatterns = securityPatterns.filter(
          (p) => p.name !== group.name,
        );
        await savePatterns();
        const codeContent = document.querySelector(".code-content");
        if (codeContent) {
          const findings = scanForSecurityIssues(codeContent.textContent);
          displayFindings(findings);
        }
      }
    });

    controlsElement.appendChild(toggleBtn);
    controlsElement.appendChild(editBtn);
    controlsElement.appendChild(deleteBtn);

    titleElement.appendChild(headerElement);
    titleElement.appendChild(controlsElement);
    groupElement.appendChild(titleElement);

    if (group.matches.length > 0) {
      group.matches.forEach((match) => {
        const itemElement = document.createElement("div");
        itemElement.className =
          "p-2 bg-gray-50 hover:bg-gray-100 rounded mb-2 text-xs cursor-pointer border border-gray-200 hover:border-gray-300";
        itemElement.textContent = match.text;
        itemElement.addEventListener("click", () => {
          // Remove active class from all items
          document.querySelectorAll(".finding-item").forEach((item) => {
            item.classList.remove("bg-blue-50", "border-blue-200");
          });
          // Add active class to clicked item
          itemElement.classList.add("bg-blue-50", "border-blue-200");
          highlightCodeAtIndex(match.index, match.text.length);
        });
        groupElement.appendChild(itemElement);
      });
    }

    container.appendChild(groupElement);
  });
}

// Function to highlight code at specific index
function highlightCodeAtIndex(index, length) {
  const codeContent = document.querySelector(".code-content");
  const text = codeContent.textContent;

  const before = text.substring(0, index);
  const matchText = text.substring(index, index + length);
  const after = text.substring(index + length);

  codeContent.innerHTML =
    escapeHtml(before) +
    `<span class="bg-amber-100 rounded">${escapeHtml(matchText)}</span>` +
    escapeHtml(after);

  // Scroll the highlighted text into view
  const highlight = codeContent.querySelector(".bg-amber-100");
  if (highlight) {
    highlight.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }
}

// Function to handle adding new patterns
function setupPatternForm() {
  const addButton = document.querySelector(".add-pattern-btn");
  const form = document.querySelector(".pattern-form");
  const submitButton = document.getElementById("addPatternBtn");

  addButton.addEventListener("click", () => {
    form.classList.toggle("hidden");
    // Clear form when opening
    if (!form.classList.contains("hidden")) {
      document.getElementById("patternName").value = "";
      document.getElementById("patternType").value = "keyword";
      document.getElementById("patternValue").value = "";
    }
  });

  submitButton.addEventListener("click", async () => {
    const name = document.getElementById("patternName").value.trim();
    const type = document.getElementById("patternType").value;
    const value = document.getElementById("patternValue").value.trim();

    if (!name || !value) return;

    if (type === "regex") {
      try {
        const pattern = new RegExp(value, "g");
        securityPatterns.push({ name, type, pattern, enabled: true });
      } catch (error) {
        console.error("Invalid regex pattern:", error);
        return;
      }
    } else {
      securityPatterns.push({
        name,
        type: "keyword",
        keywords: value.split(",").map((k) => k.trim()),
        enabled: true,
      });
    }

    await savePatterns();

    // Reset form
    document.getElementById("patternName").value = "";
    document.getElementById("patternValue").value = "";
    form.classList.add("hidden");

    // Rescan code with new pattern
    const codeContent = document.querySelector(".code-content");
    if (codeContent) {
      const findings = scanForSecurityIssues(codeContent.textContent);
      displayFindings(findings);
    }
  });
}

// Function to display the code in the popup
function displayCode(scriptContents) {
  const codeContent = document.querySelector(".code-content");
  const container = document.getElementById("codeContainer");

  if (!scriptContents || scriptContents.length === 0) {
    container.innerHTML = "<p>No JavaScript code found on this page.</p>";
    return;
  }

  let combinedCode = "";

  scriptContents.forEach((script, index) => {
    if (script.type === "Inline Script") {
      combinedCode += `// ========== Inline Script #${
        index + 1
      } ==========\n\n`;
      combinedCode += prettifyCode(script.content);
      combinedCode += "\n\n";
    } else {
      combinedCode += `// ========== External Script ==========\n`;
      combinedCode += `// Source: ${script.source}\n\n`;
    }
  });

  codeContent.textContent = combinedCode;
  updateLineNumbers();

  // Scan for security issues
  const findings = scanForSecurityIssues(combinedCode);
  displayFindings(findings);
}

function extractJavaScriptFromHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const scripts = Array.from(doc.getElementsByTagName("script"));
  const scriptContents = [];
  scripts.forEach((script) => {
    if (script.textContent.trim()) {
      scriptContents.push({
        type: "Inline Script",
        content: script.textContent.trim(),
      });
    }
    if (script.src) {
      scriptContents.push({
        type: "External Script",
        source: script.src,
      });
    }
  });
  return scriptContents;
}
