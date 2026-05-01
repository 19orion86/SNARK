"""Простой веб-интерфейс для загрузки и контроля обработки протоколов."""

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["ui"])


@router.get("/", response_class=HTMLResponse, include_in_schema=False)
async def app_index() -> str:
    """Отобразить страницу загрузки и отслеживания протоколов."""
    return """<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SNARK — Протоколы совещаний</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #0f172a;
      --card: #111827;
      --text: #e5e7eb;
      --muted: #94a3b8;
      --accent: #2563eb;
      --ok: #16a34a;
      --warn: #d97706;
      --err: #dc2626;
      --border: #334155;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, Segoe UI, Arial, sans-serif;
      background: linear-gradient(160deg, #0b1222, #111827);
      color: var(--text);
      min-height: 100vh;
      padding: 24px;
    }
    .wrap {
      max-width: 1100px;
      margin: 0 auto;
      display: grid;
      gap: 16px;
    }
    .card {
      background: rgba(17, 24, 39, 0.95);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 16px;
    }
    h1, h2 { margin: 0 0 12px; }
    .hint { color: var(--muted); font-size: 14px; margin-top: -6px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
    }
    label { font-size: 14px; color: #cbd5e1; display: block; margin-bottom: 6px; }
    input, textarea, button {
      width: 100%;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: #0b1324;
      color: var(--text);
      padding: 10px 12px;
      font-size: 14px;
    }
    textarea { min-height: 240px; resize: vertical; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
    .btn {
      width: auto;
      background: var(--accent);
      border: 1px solid #1d4ed8;
      cursor: pointer;
      padding: 10px 14px;
      font-weight: 600;
    }
    .btn.secondary { background: #0b1324; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .status {
      padding: 10px 12px;
      border-radius: 10px;
      font-size: 14px;
      border: 1px solid var(--border);
      background: #0b1324;
    }
    .s-completed { color: #86efac; border-color: #166534; }
    .s-failed { color: #fca5a5; border-color: #7f1d1d; }
    .s-processing, .s-transcribing, .s-generating, .s-uploaded { color: #fcd34d; border-color: #78350f; }
    .mono { font-family: Consolas, Menlo, monospace; font-size: 13px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Протокол совещания</h1>
      <p class="hint">Загрузи аудио/видео, дождись обработки и скачай готовый протокол в DOCX.</p>
      <form id="upload-form">
        <div class="grid">
          <div>
            <label for="title">Название совещания</label>
            <input id="title" name="title" required minlength="3" maxlength="500" placeholder="Еженедельная планерка" />
          </div>
          <div>
            <label for="meeting_date">Дата</label>
            <input id="meeting_date" name="meeting_date" type="date" required />
          </div>
          <div>
            <label for="participants">Участники (через запятую)</label>
            <input id="participants" name="participants" placeholder="Иванов И.И., Петрова А.С." />
          </div>
          <div>
            <label for="file">Файл (до 2 ГБ)</label>
            <input id="file" name="file" type="file" required />
          </div>
        </div>
        <div class="actions">
          <button id="submit-btn" class="btn" type="submit">Загрузить и запустить обработку</button>
          <button id="refresh-btn" class="btn secondary" type="button" disabled>Обновить статус</button>
          <a id="download-link" class="btn secondary" href="#" style="display:none;text-decoration:none;">Скачать DOCX</a>
        </div>
      </form>
      <div id="status" class="status mono" style="margin-top:12px;">Ожидание загрузки файла...</div>
    </div>

    <div class="card">
      <h2>Транскрибация</h2>
      <textarea id="transcript" readonly placeholder="После обработки здесь появится полный текст транскрипта..."></textarea>
    </div>

    <div class="card">
      <h2>Готовый протокол</h2>
      <textarea id="protocol" readonly placeholder="После обработки здесь появится сформированный протокол..."></textarea>
    </div>
  </div>

  <script>
    const form = document.getElementById("upload-form");
    const statusEl = document.getElementById("status");
    const transcriptEl = document.getElementById("transcript");
    const protocolEl = document.getElementById("protocol");
    const submitBtn = document.getElementById("submit-btn");
    const refreshBtn = document.getElementById("refresh-btn");
    const downloadLink = document.getElementById("download-link");

    let currentProtocolId = null;
    let pollTimer = null;

    function setStatus(text, statusName) {
      statusEl.textContent = text;
      statusEl.className = "status mono";
      if (statusName) {
        statusEl.classList.add("s-" + statusName);
      }
    }

    async function refreshProtocol() {
      if (!currentProtocolId) return;
      try {
        const res = await fetch(`/api/v1/protocols/${currentProtocolId}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.detail || "Не удалось получить статус");
        }
        const protocol = await res.json();
        transcriptEl.value = protocol.transcript_text || "";
        protocolEl.value = protocol.protocol_text || "";
        setStatus(`Протокол #${protocol.id} — статус: ${protocol.status}`, protocol.status);

        if (protocol.status === "completed") {
          downloadLink.style.display = "inline-block";
          downloadLink.href = `/api/v1/protocols/${protocol.id}/export-docx`;
          if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
        }
        if (protocol.status === "failed" && pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      } catch (err) {
        setStatus(`Ошибка получения статуса: ${err.message}`, "failed");
      }
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      submitBtn.disabled = true;
      downloadLink.style.display = "none";
      transcriptEl.value = "";
      protocolEl.value = "";

      const fd = new FormData(form);
      fd.append("source", "web");
      setStatus("Загрузка файла и постановка в очередь...", "processing");

      try {
        const res = await fetch("/api/v1/protocols/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || "Ошибка загрузки");
        }
        currentProtocolId = data.protocol_id;
        refreshBtn.disabled = false;
        setStatus(`Файл загружен. Протокол #${currentProtocolId}. Идёт обработка...`, "uploaded");

        await refreshProtocol();
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(refreshProtocol, 5000);
      } catch (err) {
        setStatus(`Ошибка: ${err.message}`, "failed");
      } finally {
        submitBtn.disabled = false;
      }
    });

    refreshBtn.addEventListener("click", refreshProtocol);
    document.getElementById("meeting_date").valueAsDate = new Date();
  </script>
</body>
</html>
"""
