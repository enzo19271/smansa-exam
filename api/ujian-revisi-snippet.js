// ════════════════════════════════════════════════════════════════════════════
// REVISI ujian.html - Snippet untuk ditambahkan ke ujian.html
// ════════════════════════════════════════════════════════════════════════════

// ── STATE untuk handle submit pending ─────────────────────────────────────
let isSubmitting = false;
const MAX_RETRY_SUBMIT = 3;
let retryCount = 0;

// ── Fungsi submitUjian REVISI dengan retry dan error handling ─────────────
async function submitUjian(autoByCheat = false) {
  clearInterval(timerInterval);
  examStarted = false;
  bootstrap.Modal.getInstance(document.getElementById("modalSelesai"))?.hide();

  // Tampilkan loading modal
  new bootstrap.Modal(document.getElementById("modalLoading")).show();
  
  // Update modal loading dengan pesan dan progress
  updateLoadingModal(0, "Mempersiapkan pengumpulan jawaban...");

  if (isSubmitting) {
    console.log("Submit sudah berjalan, tunggu...");
    return;
  }
  
  isSubmitting = true;
  retryCount = 0;

  async function executeSubmit() {
    try {
      updateLoadingModal(30, "Mengirim jawaban ke server...");

      const submitPayload = {
        nama,
        kelas,
        mapel_id: mapelId,
        jawaban,
        ujian_id: ujianId,
        cheat_count: cheatCount,
        auto_submit_cheat: autoByCheat,
      };

      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitPayload),
        signal: AbortSignal.timeout ? AbortSignal.timeout(30000) : undefined, // 30s timeout
      });

      updateLoadingModal(60, "Memproses hasil ujian...");
      const result = await res.json();

      if (!res.ok) {
        // Handle error response
        if (res.status === 429 && result.error === "pending") {
          // Server sedang process submit lain
          throw {
            code: "PENDING",
            message: result.message,
            retry: true,
            delay: (result.retry_after || 3) * 1000
          };
        } else if (res.status === 409 && result.error === "duplicate") {
          // Sudah ada hasil sebelumnya
          throw {
            code: "DUPLICATE",
            message: result.message,
            retry: false
          };
        } else {
          throw {
            code: "SERVER_ERROR",
            message: result.error || "Gagal menyimpan jawaban",
            retry: true
          };
        }
      }

      // Success
      localStorage.removeItem(LS_JAWABAN);
      localStorage.removeItem(LS_TIMER);
      localStorage.removeItem(LS_SOAL);

      sessionStorage.setItem("hasil_ujian", JSON.stringify(result));
      
      updateLoadingModal(100, "Selesai! Mengarahkan ke halaman hasil...");
      setTimeout(() => {
        location.href = "selesai.html";
      }, 500);

    } catch (err) {
      console.error("Submit error:", err);

      // Tentukan apakah perlu retry
      const isRetryable = err.retry !== false && retryCount < MAX_RETRY_SUBMIT;
      const delay = err.delay || 2000;

      if (isRetryable) {
        retryCount++;
        updateLoadingModal(
          45,
          `⏳ ${err.message || "Terjadi kendala. Mencoba ulang..."}\nPercobaan ${retryCount}/${MAX_RETRY_SUBMIT}...`,
          true
        );
        
        // Tunggu, lalu retry
        await new Promise(resolve => setTimeout(resolve, delay));
        return executeSubmit(); // Recursive retry
      } else {
        // Submit error tidak bisa di-retry
        bootstrap.Modal.getInstance(document.getElementById("modalLoading"))?.hide();
        
        let errorMsg = "Gagal mengumpulkan jawaban.\n\nJawaban kamu aman tersimpan di perangkat.\n";
        
        if (err.code === "DUPLICATE") {
          errorMsg += `\n${err.message}`;
        } else if (err.code === "PENDING") {
          errorMsg += "Server sedang sibuk. Silakan coba lagi dalam beberapa saat.";
        } else {
          errorMsg += "Periksa koneksi internet, lalu coba lagi.";
        }
        
        examStarted = true; // Aktifkan kembali jika bisa
        isSubmitting = false;
        
        alert(errorMsg);
      }
    }
  }

  await executeSubmit();
}

// ── Helper: Update loading modal dengan progress bar dan message ─────────
function updateLoadingModal(progress = 0, message = "", isPending = false) {
  const modal = document.getElementById("modalLoading");
  if (!modal) return;

  // Update message
  let msgEl = modal.querySelector(".modal-body p");
  if (!msgEl) {
    msgEl = document.createElement("p");
    modal.querySelector(".modal-body")?.appendChild(msgEl);
  }
  msgEl.textContent = message;
  msgEl.style.fontSize = "0.95rem";
  msgEl.style.color = isPending ? "#f59e0b" : "#0f172a";

  // Update atau buat progress bar
  let progressBar = modal.querySelector(".progress-bar");
  if (!progressBar) {
    const progressDiv = document.createElement("div");
    progressDiv.className = "progress mt-3";
    progressDiv.style.height = "6px";
    progressBar = document.createElement("div");
    progressBar.className = "progress-bar";
    progressBar.role = "progressbar";
    progressDiv.appendChild(progressBar);
    modal.querySelector(".modal-body")?.appendChild(progressDiv);
  }
  
  progressBar.style.width = progress + "%";
  progressBar.setAttribute("aria-valuenow", progress);
  
  // Jika pending, beri animasi
  if (isPending) {
    progressBar.style.animation = "pulse 1s infinite";
  } else {
    progressBar.style.animation = "none";
  }
}
