// The copy buttons on /install — the clone's one script, matching the live
// product's: copy the snippet named by data-copy, flash "Copied ✓" for 1.5 s.
// The label is read once, so a second click mid-flash can't make the flash stick.
for (const button of document.querySelectorAll(".copy-btn")) {
  const label = button.textContent;
  button.addEventListener("click", async () => {
    const text = document.getElementById(button.dataset.copy ?? "")?.textContent;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copied ✓";
      button.classList.add("copied");
      setTimeout(() => {
        button.textContent = label;
        button.classList.remove("copied");
      }, 1500);
    } catch {}
  });
}
