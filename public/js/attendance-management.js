document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth();
  if (!user) {
    return;
  }

  // Update UI
  document.querySelectorAll('[data-admin-name]').forEach((element) => {
    element.textContent = user.name;
  });

  updateRoleBasedUI(user.role);
  document.getElementById('logoutButton')?.addEventListener('click', logout);

  // Global variables
  let classes = [];
  let currentClass = null;
  let currentSubject = null;
  let students = [];
  let attendanceData = {};

  // Event listeners
  document.getElementById('refreshButton')?.addEventListener('click', loadInitialData);
  document.getElementById('loadStudentsButton')?.addEventListener('click', loadStudents);
  document.getElementById('classSelect')?.addEventListener('change', handleClassChange);
  document.getElementById('sectionSelect')?.addEventListener('change', handleSectionChange);
  document.getElementById('subjectSelect')?.addEventListener('change', handleSubjectChange);
  document.getElementById('dateSelect')?.addEventListener('change', loadStudents);
  document.getElementById('selectAllCheckbox')?.addEventListener('change', toggleSelectAll);
  document.getElementById('markAllPresentButton')?.addEventListener('click', () => markAllStatus('present'));
  document.getElementById('markAllAbsentButton')?.addEventListener('click', () => markAllStatus('absent'));
  document.getElementById('saveAttendanceButton')?.addEventListener('click', saveAttendance);

  // Load initial data
  await loadInitialData();
  setDefaultDate();

  async function loadInitialData() {
    showLoading(true);
    try {
      // Load classes
      const classesResponse = await api.get('/api/classes');
      classes = classesResponse.data.classes;
      
      // Populate class selector
      const classSelect = document.getElementById('classSelect');
      classSelect.innerHTML = '<option value="">All Classes</option>' +
        classes.map(cls => `<option value="${cls.name}">${cls.name} - ${cls.section}</option>`).join('');
      
      // Load initial stats
      await loadStats();
    } catch (error) {
      ui.toast(error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  async function loadStats() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      
      const [todayResponse, weekResponse, lowAttendanceResponse] = await Promise.all([
        api.get(`/api/attendance-enhanced?date=${today}`),
        api.get(`/api/attendance-enhanced?startDate=${weekStart.toISOString().split('T')[0]}`),
        api.get('/api/attendance-enhanced/analytics/low-attendance?threshold=75')
      ]);

      document.getElementById('totalStudentsStat').textContent = 
        (await api.get('/api/users?role=student')).data.pagination.total || 0;
      
      document.getElementById('todayAttendanceStat').textContent = 
        todayResponse.data.pagination.total || 0;
      
      const weekAttendance = weekResponse.data.attendance;
      const presentCount = weekAttendance.filter(a => a.status === 'present').length;
      const totalCount = weekAttendance.length;
      const weekPercentage = totalCount > 0 ? (presentCount / totalCount * 100).toFixed(1) : 0;
      document.getElementById('weekAttendanceStat').textContent = weekPercentage + '%';
      
      document.getElementById('lowAttendanceStat').textContent = lowAttendanceResponse.data.count || 0;
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  async function handleClassChange(e) {
    currentClass = e.target.value;
    await loadSubjects();
    await loadStudents();
  }

  async function handleSectionChange(e) {
    await loadStudents();
  }

  async function handleSubjectChange(e) {
    currentSubject = e.target.value;
    enableBulkActions();
    await loadStudents();
  }

  async function loadSubjects() {
    const subjectSelect = document.getElementById('subjectSelect');
    
    if (!currentClass) {
      subjectSelect.innerHTML = '<option value="">Select a class first</option>';
      subjectSelect.disabled = true;
      return;
    }

    const classData = classes.find(cls => cls.name === currentClass);
    if (!classData || !classData.subjects) {
      subjectSelect.innerHTML = '<option value="">No subjects available</option>';
      subjectSelect.disabled = true;
      return;
    }

    subjectSelect.innerHTML = '<option value="">All Subjects</option>' +
      classData.subjects.map(subject => `<option value="${subject}">${subject}</option>`).join('');
    subjectSelect.disabled = false;
  }

  async function loadStudents() {
    const classSelect = document.getElementById('classSelect').value;
    const sectionSelect = document.getElementById('sectionSelect').value;
    const subjectSelect = document.getElementById('subjectSelect').value;
    const dateSelect = document.getElementById('dateSelect').value;

    if (!classSelect) {
      showEmptyState();
      return;
    }

    showLoading(true);
    try {
      const params = new URLSearchParams();
      if (classSelect) params.append('class', classSelect);
      if (sectionSelect) params.append('section', sectionSelect);
      if (subjectSelect) params.append('subject', subjectSelect);
      if (dateSelect) params.append('date', dateSelect);

      const response = await api.get(`/api/attendance-enhanced?${params}`);
      students = response.data.attendance || [];
      
      // Update table title
      const tableTitle = document.getElementById('tableTitle');
      const tableSubtitle = document.getElementById('tableSubtitle');
      
      if (subjectSelect) {
        tableTitle.textContent = `${classSelect} - ${subjectSelect} Attendance`;
        tableSubtitle.textContent = `Showing attendance for ${dateSelect || 'today'}`;
      } else {
        tableTitle.textContent = `${classSelect} Attendance`;
        tableSubtitle.textContent = `Showing attendance for ${dateSelect || 'today'}`;
      }

      renderAttendanceTable();
      loadExistingAttendance();
    } catch (error) {
      ui.toast(error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  function renderAttendanceTable() {
    const tbody = document.getElementById('attendanceTableBody');
    
    if (!students.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px;">
            No students found for the selected criteria.
          </td>
        </tr>
      `;
      disableBulkActions();
      return;
    }

    tbody.innerHTML = students.map(student => {
      const statusClass = `status-${student.status}`;
      const isChecked = attendanceData[student.student._id] ? 'checked' : '';
      
      return `
        <tr class="student-row" data-student-id="${student.student._id}">
          <td>
            <input type="checkbox" class="student-checkbox" data-student-id="${student.student._id}" ${isChecked} />
          </td>
          <td>${student.student.studentId || 'N/A'}</td>
          <td>${escapeHtml(student.student.name)}</td>
          <td>${student.class || 'N/A'}</td>
          <td>
            <span class="chip ${statusClass}">${student.status || 'N/A'}</span>
          </td>
          <td>
            <select class="status-select" data-student-id="${student.student._id}">
              <option value="">Select</option>
              <option value="present" ${student.status === 'present' ? 'selected' : ''}>Present</option>
              <option value="absent" ${student.status === 'absent' ? 'selected' : ''}>Absent</option>
              <option value="late" ${student.status === 'late' ? 'selected' : ''}>Late</option>
              <option value="excused" ${student.status === 'excused' ? 'selected' : ''}>Excused</option>
            </select>
          </td>
          <td>
            <input type="text" class="remarks-input" data-student-id="${student.student._id}" 
                   value="${escapeHtml(student.remarks || '')}" 
                   placeholder="Add remarks..." />
          </td>
        </tr>
      `;
    }).join('');

    // Add event listeners to new elements
    tbody.querySelectorAll('.student-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', handleStudentCheckboxChange);
    });
    
    tbody.querySelectorAll('.status-select').forEach(select => {
      select.addEventListener('change', handleStatusChange);
    });
    
    tbody.querySelectorAll('.remarks-input').forEach(input => {
      input.addEventListener('input', handleRemarksChange);
    });

    enableBulkActions();
  }

  function loadExistingAttendance() {
    const dateSelect = document.getElementById('dateSelect').value;
    const subjectSelect = document.getElementById('subjectSelect').value;
    
    if (!dateSelect || !subjectSelect) return;

    // Load existing attendance for the selected date and subject
    students.forEach(student => {
      const key = `${student.student._id}-${dateSelect}-${subjectSelect}`;
      const existingRecord = students.find(s => 
        s.student._id === student.student._id && 
        s.date === dateSelect && 
        s.subject === subjectSelect
      );
      
      if (existingRecord) {
        attendanceData[student.student._id] = existingRecord;
        
        // Update UI with existing data
        const checkbox = document.querySelector(`[data-student-id="${student.student._id}"]`);
        const statusSelect = document.querySelector(`[data-student-id="${student.student._id}"].status-select`);
        const remarksInput = document.querySelector(`[data-student-id="${student.student._id}"].remarks-input`);
        
        if (checkbox) checkbox.checked = true;
        if (statusSelect) statusSelect.value = existingRecord.status;
        if (remarksInput) remarksInput.value = existingRecord.remarks || '';
      }
    });
  }

  function handleStudentCheckboxChange(e) {
    const studentId = e.target.dataset.studentId;
    if (e.target.checked) {
      e.target.closest('tr').classList.add('selected');
    } else {
      e.target.closest('tr').classList.remove('selected');
      delete attendanceData[studentId];
    }
  }

  function handleStatusChange(e) {
    const studentId = e.target.dataset.studentId;
    const status = e.target.value;
    
    if (!attendanceData[studentId]) {
      attendanceData[studentId] = {
        studentId: students.find(s => s.student._id === studentId)?.studentId,
        status: status,
        remarks: ''
      };
    } else {
      attendanceData[studentId].status = status;
    }
    
    // Update row styling
    const row = e.target.closest('tr');
    row.className = `student-row status-${status}`;
  }

  function handleRemarksChange(e) {
    const studentId = e.target.dataset.studentId;
    const remarks = e.target.value;
    
    if (!attendanceData[studentId]) {
      attendanceData[studentId] = {
        studentId: students.find(s => s.student._id === studentId)?.studentId,
        status: 'present',
        remarks: remarks
      };
    } else {
      attendanceData[studentId].remarks = remarks;
    }
  }

  function toggleSelectAll(e) {
    const checkboxes = document.querySelectorAll('.student-checkbox');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    
    checkboxes.forEach(checkbox => {
      checkbox.checked = e.target.checked;
      const row = checkbox.closest('tr');
      if (e.target.checked) {
        row.classList.add('selected');
      } else {
        row.classList.remove('selected');
        const studentId = checkbox.dataset.studentId;
        delete attendanceData[studentId];
      }
    });
  }

  function markAllStatus(status) {
    const selectedCheckboxes = document.querySelectorAll('.student-checkbox:checked');
    
    selectedCheckboxes.forEach(checkbox => {
      const studentId = checkbox.dataset.studentId;
      const statusSelect = document.querySelector(`[data-student-id="${studentId}"].status-select`);
      
      if (statusSelect) {
        statusSelect.value = status;
        const row = checkbox.closest('tr');
        row.className = `student-row status-${status}`;
        
        if (!attendanceData[studentId]) {
          attendanceData[studentId] = {
            studentId: students.find(s => s.student._id === studentId)?.studentId,
            status: status,
            remarks: ''
          };
        } else {
          attendanceData[studentId].status = status;
        }
      }
    });
  }

  async function saveAttendance() {
    const classSelect = document.getElementById('classSelect').value;
    const sectionSelect = document.getElementById('sectionSelect').value;
    const subjectSelect = document.getElementById('subjectSelect').value;
    const dateSelect = document.getElementById('dateSelect').value;

    if (!classSelect || !subjectSelect || !dateSelect) {
      ui.toast('Please select class, subject, and date', 'error');
      return;
    }

    const attendanceRecords = Object.values(attendanceData).filter(data => data.status);
    
    if (attendanceRecords.length === 0) {
      ui.toast('No attendance changes to save', 'error');
      return;
    }

    showLoading(true);
    try {
      const response = await api.post('/api/attendance-enhanced/bulk-mark', {
        class: classSelect,
        section: sectionSelect || 'A',
        subject: subjectSelect,
        date: dateSelect,
        attendanceRecords: attendanceRecords.map(record => ({
          studentId: record.studentId,
          status: record.status,
          remarks: record.remarks
        }))
      });

      ui.toast(response.message, response.success ? 'success' : 'error');
      
      if (response.success) {
        // Clear attendance data and reload
        attendanceData = {};
        await loadStudents();
      }
    } catch (error) {
      ui.toast(error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  function enableBulkActions() {
    const hasSelection = Object.keys(attendanceData).length > 0;
    document.getElementById('markAllPresentButton').disabled = !hasSelection;
    document.getElementById('markAllAbsentButton').disabled = !hasSelection;
    document.getElementById('saveAttendanceButton').disabled = !hasSelection;
  }

  function disableBulkActions() {
    document.getElementById('markAllPresentButton').disabled = true;
    document.getElementById('markAllAbsentButton').disabled = true;
    document.getElementById('saveAttendanceButton').disabled = true;
  }

  function showEmptyState() {
    const tbody = document.getElementById('attendanceTableBody');
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px;">
          Select a class to view students
        </td>
      </tr>
    `;
    disableBulkActions();
  }

  function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateSelect').value = today;
  }

  function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function updateRoleBasedUI(role) {
    document.querySelectorAll('.admin-only, .teacher-only, .student-only').forEach(element => {
      element.style.display = 'none';
    });

    document.querySelectorAll(`.${role}-only`).forEach(element => {
      element.style.display = '';
    });

    if (role === 'admin' || role === 'teacher') {
      document.querySelectorAll('.admin-only, .teacher-only').forEach(element => {
        element.style.display = '';
      });
    }
  }
});
