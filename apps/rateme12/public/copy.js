// The copy buttons on /install — the clone's one script, matching the live
// product's: copy the snippet named by data-copy, flash "Copied ✓" for 1.5 s.
for (const button of document.querySelectorAll(".copy-btn")) {
  button.addEventListener("click", async () => {
    const text = document.getElementById(button.dataset.copy ?? "")?.textContent;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const label = button.textContent;
      button.textContent = "Copied ✓";
      button.classList.add("copied");
      setTimeout(() => {
        button.textContent = label;
        button.classList.remove("copied");
      }, 1500);
    } catch {}
  });
}
