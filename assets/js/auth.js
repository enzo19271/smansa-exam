// assets/js/auth.js
// Helper login, logout, session

const Auth = {
  // Simpan session ke sessionStorage
  setSession(user) {
    sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(user));
  },

  // Ambil session
  getSession() {
    const raw = sessionStorage.getItem(CONFIG.SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  // Hapus session (logout)
  clearSession() {
    sessionStorage.removeItem(CONFIG.SESSION_KEY);
  },

  // Cek apakah sudah login, jika tidak redirect ke index
  requireLogin(redirectTo = "/index.html") {
    const user = this.getSession();
    if (!user) {
      window.location.href = redirectTo;
      return null;
    }
    return user;
  },

  // Cek role, jika salah redirect ke halaman yang sesuai
  requireRole(expectedRole) {
    const user = this.requireLogin();
    if (!user) return null;
    if (user.role !== expectedRole) {
      this.redirectByRole(user.role);
      return null;
    }
    return user;
  },

  // Redirect ke dashboard sesuai role
  redirectByRole(role) {
    const map = {
      siswa: "/siswa/dashboard.html",
      guru:  "/guru/dashboard.html",
      admin: "/admin/dashboard.html",
    };
    window.location.href = map[role] || "/index.html";
  },

  // Proses login – hit API
  async login(username, password) {
    const res = await fetch(`${CONFIG.API_BASE}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login gagal");
    this.setSession(data.user);
    return data.user;
  },

  // Logout
  logout() {
    this.clearSession();
    window.location.href = "/index.html";
  },
};
