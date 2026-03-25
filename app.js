/* ===== SIIF School Management System – API client ===== */

const API = 'http://localhost:3000/api';
const $ = id => document.getElementById(id);

// ── Auth helpers ──────────────────────────────────────────────────────────────
function getSession()       { try { return JSON.parse(sessionStorage.getItem('siif_session')); } catch { return null; } }
function setSession(data)   { sessionStorage.setItem('siif_session', JSON.stringify(data)); }
function clearSession()     { sessionStorage.removeItem('siif_session'); }

// ── Generic fetch wrapper ─────────────────────────────────────────────────────
async function api(method, endpoint, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + endpoint, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const isLoginPage = document.body.classList.contains('login-body');

// ── Auth guard ────────────────────────────────────────────────────────────────
if (!isLoginPage && !getSession()) {
  window.location.href = 'index.html';
}

// =============================================================================
// LOGIN PAGE
// =============================================================================
if (isLoginPage) {
  if (getSession()) window.location.href = 'dashboard.html';

  $('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const email    = $('email').value.trim();
    const password = $('password').value.trim();
    let valid = true;

    $('emailError').textContent  = '';
    $('passwordError').textContent = '';
    $('loginError').textContent    = '';

    if (!email) {
      $('emailError').textContent = 'Email is required.'; valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      $('emailError').textContent = 'Enter a valid email address.'; valid = false;
    }
    if (!password) { $('passwordError').textContent = 'Password is required.'; valid = false; }
    if (!valid) return;

    const btn = this.querySelector('button[type=submit]');
    btn.textContent = 'Logging in…';
    btn.disabled = true;

    try {
      const data = await api('POST', '/login', { email, password });
      setSession({ email: data.email });
      window.location.href = 'dashboard.html';
    } catch (err) {
      $('loginError').textContent = err.message;
      btn.textContent = 'Login';
      btn.disabled = false;
    }
  });
}

// =============================================================================
// DASHBOARD
// =============================================================================
if (!isLoginPage) {

  // ── Navigation ──────────────────────────────────────────────────────────────
  const navLinks = document.querySelectorAll('.nav-link');
  const pages    = document.querySelectorAll('.page');
  const sidebar  = $('sidebar');
  const overlay  = $('overlay');

  function showPage(name) {
    pages.forEach(p => p.classList.remove('active'));
    navLinks.forEach(l => l.classList.remove('active'));
    const page = $('page-' + name);
    if (page) page.classList.add('active');
    const link = document.querySelector(`.nav-link[data-page="${name}"]`);
    if (link) link.classList.add('active');
    closeSidebar();
    if (name === 'home')     loadStats();
    if (name === 'students') loadStudents();
    if (name === 'teachers') loadTeachers();
    if (name === 'courses')  loadCourses();
  }

  navLinks.forEach(link => {
    link.addEventListener('click', e => { e.preventDefault(); showPage(link.dataset.page); });
  });

  // ── Mobile sidebar ──────────────────────────────────────────────────────────
  $('hamburger').addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  });

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  }
  overlay.addEventListener('click', closeSidebar);

  // ── Logout ──────────────────────────────────────────────────────────────────
  function logout() { clearSession(); window.location.href = 'index.html'; }
  $('logoutBtn').addEventListener('click', logout);
  $('logoutBtnMobile').addEventListener('click', logout);

  // ── Stats ───────────────────────────────────────────────────────────────────
  async function loadStats() {
    try {
      const data = await api('GET', '/stats');
      $('totalStudents').textContent = data.students;
      $('totalTeachers').textContent = data.teachers;
      $('totalCourses').textContent  = data.courses;
    } catch (err) {
      console.error('Stats error:', err);
    }
  }

  // ===========================================================================
  // STUDENTS
  // ===========================================================================
  let editingStudentId = null;

  async function loadStudents(q = '') {
    const endpoint = q ? `/students?q=${encodeURIComponent(q)}` : '/students';
    try {
      const students = await api('GET', endpoint);
      renderStudentsTable(students);
    } catch (err) {
      showToast('Failed to load students: ' + err.message, 'error');
    }
  }

  function renderStudentsTable(students) {
    const tbody = $('studentsBody');
    const empty = $('studentsEmpty');
    tbody.innerHTML = '';

    if (students.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${escHtml(s.name)}</td>
        <td>${escHtml(s.code)}</td>
        <td>${escHtml(s.class)}</td>
        <td>
          <div class="action-btns">
            <button class="btn btn-edit"   data-id="${s.id}">✏️ Edit</button>
            <button class="btn btn-danger" data-id="${s.id}">🗑️ Delete</button>
          </div>
        </td>`;
      tbody.appendChild(tr);
    });

    // Attach events
    tbody.querySelectorAll('.btn-edit').forEach(btn =>
      btn.addEventListener('click', () => openEditStudent(btn.dataset.id)));
    tbody.querySelectorAll('.btn-danger').forEach(btn =>
      btn.addEventListener('click', () => deleteStudent(btn.dataset.id)));
  }

  function openStudentModal(student = null) {
    editingStudentId = student ? student.id : null;
    $('studentModalTitle').textContent = student ? 'Edit Student' : 'Add Student';
    $('studentName').value  = student ? student.name  : '';
    $('studentCode').value  = student ? student.code  : '';
    $('studentClass').value = student ? student.class : '';
    clearStudentErrors();
    $('studentModal').classList.add('active');
    $('studentName').focus();
  }

  async function openEditStudent(id) {
    try {
      const students = await api('GET', '/students');
      const student  = students.find(s => String(s.id) === String(id));
      if (student) openStudentModal(student);
    } catch (err) {
      showToast('Could not load student: ' + err.message, 'error');
    }
  }

  function closeStudentModal() {
    $('studentModal').classList.remove('active');
    editingStudentId = null;
  }

  function clearStudentErrors() {
    ['studentNameError','studentCodeError','studentClassError'].forEach(id => $(id).textContent = '');
  }

  $('addStudentBtn').addEventListener('click', () => openStudentModal());
  $('cancelStudentBtn').addEventListener('click', closeStudentModal);
  $('studentModal').addEventListener('click', e => {
    if (e.target === $('studentModal')) closeStudentModal();
  });

  $('studentForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    clearStudentErrors();
    const name = $('studentName').value.trim();
    const code = $('studentCode').value.trim();
    const cls  = $('studentClass').value.trim();
    let valid  = true;

    if (!name) { $('studentNameError').textContent  = 'Name is required.';       valid = false; }
    if (!code) { $('studentCodeError').textContent  = 'Student ID is required.'; valid = false; }
    if (!cls)  { $('studentClassError').textContent = 'Class is required.';      valid = false; }
    if (!valid) return;

    const saveBtn = this.querySelector('button[type=submit]');
    saveBtn.disabled = true;

    try {
      if (editingStudentId) {
        await api('PUT', `/students/${editingStudentId}`, { name, code, class: cls });
        showToast('Student updated.');
      } else {
        await api('POST', '/students', { name, code, class: cls });
        showToast('Student added.');
      }
      closeStudentModal();
      loadStudents($('studentSearch').value);
      loadStats();
    } catch (err) {
      if (err.message.includes('ID already exists')) {
        $('studentCodeError').textContent = err.message;
      } else {
        showToast(err.message, 'error');
      }
    } finally {
      saveBtn.disabled = false;
    }
  });

  async function deleteStudent(id) {
    if (!confirm('Delete this student?')) return;
    try {
      await api('DELETE', `/students/${id}`);
      showToast('Student deleted.');
      loadStudents($('studentSearch').value);
      loadStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  let searchTimer;
  $('studentSearch').addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadStudents(this.value), 300);
  });

  // ===========================================================================
  // TEACHERS
  // ===========================================================================
  async function loadTeachers() {
    try {
      const teachers = await api('GET', '/teachers');
      const grid = $('teachersGrid');
      grid.innerHTML = '';
      teachers.forEach(t => {
        const card = document.createElement('div');
        card.className = 'info-card green-border';
        card.innerHTML = `
          <span class="badge">Teacher</span>
          <h4>${escHtml(t.name)}</h4>
          <p>📖 ${escHtml(t.subject)}</p>`;
        grid.appendChild(card);
      });
    } catch (err) {
      showToast('Failed to load teachers: ' + err.message, 'error');
    }
  }

  // ===========================================================================
  // COURSES
  // ===========================================================================
  async function loadCourses() {
    try {
      const courses = await api('GET', '/courses');
      const grid = $('coursesGrid');
      grid.innerHTML = '';
      courses.forEach(c => {
        const card = document.createElement('div');
        card.className = 'info-card teal-border';
        card.innerHTML = `
          <span class="badge" style="background:#e6f4ea;color:#34a853">Course</span>
          <h4>${escHtml(c.name)}</h4>
          <p>👨‍🏫 ${escHtml(c.teacher)}</p>
          <p style="margin-top:0.4rem">${escHtml(c.description)}</p>`;
        grid.appendChild(card);
      });
    } catch (err) {
      showToast('Failed to load courses: ' + err.message, 'error');
    }
  }

  // ===========================================================================
  // CONTACT
  // ===========================================================================
  $('contactForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const name    = $('contactName').value.trim();
    const email   = $('contactEmail').value.trim();
    const message = $('contactMessage').value.trim();
    let valid = true;

    ['contactNameError','contactEmailError','contactMessageError'].forEach(id => $(id).textContent = '');
    $('contactSuccess').textContent = '';

    if (!name)    { $('contactNameError').textContent    = 'Name is required.';          valid = false; }
    if (!email)   { $('contactEmailError').textContent   = 'Email is required.';         valid = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    $('contactEmailError').textContent   = 'Enter a valid email.';        valid = false; }
    if (!message) { $('contactMessageError').textContent = 'Message is required.';       valid = false; }
    if (!valid) return;

    const btn = this.querySelector('button[type=submit]');
    btn.disabled = true;

    try {
      await api('POST', '/contact', { name, email, message });
      $('contactSuccess').textContent = "✅ Message sent! We'll get back to you soon.";
      this.reset();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // ===========================================================================
  // TOAST NOTIFICATIONS
  // ===========================================================================
  function showToast(msg, type = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;display:flex;flex-direction:column;gap:0.5rem;';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.style.cssText = `
      background:${type === 'error' ? '#e53935' : '#34a853'};
      color:#fff;padding:0.75rem 1.2rem;border-radius:8px;
      font-size:0.9rem;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.2);
      animation:fadeUp 0.25s ease;max-width:320px;`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  // ── XSS helper ──────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Init ────────────────────────────────────────────────────────────────────
  loadStats();
  loadStudents();
  loadTeachers();
  loadCourses();
}
