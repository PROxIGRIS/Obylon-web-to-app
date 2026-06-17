export function renderErrorPage(error?: unknown): string {
  let errorText = "Check your browser console for the exact stack trace, or SSR threw an error.";
  let showTrace = false; // We can't strictly know process.env here without a bundler pass sometimes, but assuming it's built...
  
  if (error) {
    showTrace = true;
    if (error instanceof Error) {
      errorText = `${error.name}: ${error.message}\\n${error.stack || ''}`;
    } else {
      try {
        errorText = JSON.stringify(error, null, 2);
      } catch {
        errorText = String(error);
      }
    }
  }

  // Escape HTML to prevent injection
  const safeErrorText = errorText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  return `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="utf-8" />
    <title>Application Error</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        --background: 0 0% 100%;
        --foreground: 240 10% 3.9%;
        --muted: 240 4.8% 95.9%;
        --muted-foreground: 240 3.8% 46.1%;
        --border: 240 5.9% 90%;
      }
      .dark {
        --background: 240 10% 3.9%;
        --foreground: 0 0% 98%;
        --muted: 240 3.7% 15.9%;
        --muted-foreground: 240 5% 64.9%;
        --border: 240 3.7% 15.9%;
      }
      body {
        margin: 0;
        min-height: 100vh;
        background-color: hsl(var(--background));
        color: hsl(var(--foreground));
        font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .container {
        position: relative;
        z-index: 10;
        max-width: 40rem;
        width: 100%;
        text-align: center;
        padding: 2rem;
      }
      .icon-box {
        width: 4rem;
        height: 4rem;
        border-radius: 9999px;
        border: 1px solid hsl(var(--border));
        background-color: hsl(var(--muted));
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 1.5rem auto;
      }
      h1 { font-size: 2.25rem; margin-bottom: 0.75rem; font-weight: 500; font-family: ui-serif, Georgia, serif; letter-spacing: -0.025em; }
      p.desc { color: hsl(var(--muted-foreground)); font-size: 1rem; margin-bottom: 2rem; font-weight: 500; }
      #error-box {
        background: hsl(var(--muted));
        border: 1px solid hsl(var(--border));
        padding: 1rem;
        border-radius: 0.5rem;
        text-align: left;
        font-family: monospace;
        color: hsl(var(--muted-foreground));
        font-size: 0.75rem;
        white-space: pre-wrap;
        word-break: break-all;
        margin-bottom: 2rem;
        max-height: 200px;
        overflow-y: auto;
      }
      button {
        background: hsl(var(--foreground));
        color: hsl(var(--background));
        border: none;
        padding: 0.625rem 1.5rem;
        border-radius: 0.375rem;
        cursor: pointer;
        font-weight: 600;
        font-size: 0.875rem;
        transition: transform 0.1s;
      }
      button:active { transform: scale(0.95); }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="icon-box">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: hsl(var(--muted-foreground));"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
      </div>
      <h1>Application Error</h1>
      <p class="desc">An unexpected error occurred during initialization.</p>
      <!-- Error trace only shown if an error was captured on the server -->
      ${showTrace ? '<div id="error-box">' + safeErrorText + '</div>' : '<div id="error-box" style="display:none"></div>'}
      <button onclick="location.reload()">Reload Page</button>
    </div>
    <script>
      if (!${!!error} && window.__vite_plugin_react_preamble_installed__) {
        const box = document.getElementById('error-box');
        box.style.display = 'block';
        box.innerText = 'Vite loaded. Check browser console.';
      }
    </script>
  </body>
</html>`;
}
