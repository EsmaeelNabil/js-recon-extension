chrome.action.onClicked.addListener(async (tab) => {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => document.documentElement.outerHTML,
    });
    const pageContent = result.result;
    if (
      !pageContent ||
      typeof pageContent !== "string" ||
      pageContent.trim() === ""
    ) {
      console.error("Invalid page content.");
      return;
    }
    await chrome.storage.local.set({ pageContent });
    const storedData = await chrome.storage.local.get("pageContent");
    if (!storedData.pageContent || storedData.pageContent.trim() === "") {
      console.error("Stored page content is invalid.");
      return;
    }
    chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
  } catch (error) {
    console.error("Error extracting page content:", error);
  }
});
