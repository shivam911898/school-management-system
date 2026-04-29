const assert = require("assert");

const BASE_URL = process.env.BASE_URL || "http://localhost:5002";

const creds = {
  admin: {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  },
  teacher: {
    email: process.env.TEACHER_EMAIL || "sarah.j@school.com",
    password: process.env.TEACHER_PASSWORD || "teacher123",
  },
  student: {
    email: process.env.STUDENT_EMAIL || "sneha.reddy1001@school.com",
    password: process.env.STUDENT_PASSWORD || "student123",
  },
};

const parseSetCookie = (headers) => {
  const setCookie = headers.get("set-cookie");
  if (!setCookie) return null;
  return setCookie.split(";")[0];
};

const jsonFetch = async (path, { method = "GET", body, cookie } = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_error) {
    data = { raw: text };
  }

  return { response, data, text };
};

const loginAndGetCookie = async ({ email, password, role }) => {
  const { response, data } = await jsonFetch("/api/auth/login", {
    method: "POST",
    body: { email, password, ...(role ? { role } : {}) },
  });

  assert.strictEqual(
    response.status,
    200,
    `login failed for ${email}: ${JSON.stringify(data)}`,
  );
  const cookie = parseSetCookie(response.headers);
  assert(cookie, `missing auth cookie for ${email}`);
  return cookie;
};

const run = async () => {
  console.log(`[rbac] base url: ${BASE_URL}`);

  const studentCookie = await loginAndGetCookie(creds.student);
  const teacherCookie = await loginAndGetCookie(creds.teacher);

  if (!creds.admin.email || !creds.admin.password) {
    console.log(
      "[rbac] admin creds not provided via ADMIN_EMAIL/ADMIN_PASSWORD, skipping admin create-user check",
    );
  }

  // Student must be denied on admin users list
  {
    const { response } = await jsonFetch("/api/users", {
      cookie: studentCookie,
    });
    assert.strictEqual(
      response.status,
      403,
      "student should not access /api/users",
    );
  }

  // Student must be denied on create-user endpoint
  {
    const { response } = await jsonFetch("/api/users", {
      method: "POST",
      cookie: studentCookie,
      body: {
        name: "Blocked Student Create",
        email: `blocked.${Date.now()}@school.com`,
        password: "Password1",
        role: "student",
        studentId: `BLK${Date.now()}`,
        class: "10A",
      },
    });
    assert.strictEqual(response.status, 403, "student should not create users");
  }

  // Student must be denied on teachers-by-subject
  {
    const { response } = await jsonFetch(
      "/api/users/teachers/subject/Mathematics",
      { cookie: studentCookie },
    );
    assert.strictEqual(
      response.status,
      403,
      "student should not access /api/users/teachers/subject/:subject",
    );
  }

  // Student must be denied on student records list (teacher/admin only)
  {
    const { response } = await jsonFetch("/api/students", {
      cookie: studentCookie,
    });
    assert.strictEqual(
      response.status,
      403,
      "student should not access /api/students",
    );
  }

  // Student must be denied notice publishing
  {
    const { response } = await jsonFetch("/api/notices", {
      method: "POST",
      cookie: studentCookie,
      body: {
        title: "Blocked notice",
        description: "blocked",
        date: new Date().toISOString().slice(0, 10),
        type: "normal",
        targetAudience: "all",
      },
    });
    assert.strictEqual(
      response.status,
      403,
      "student should not create notices",
    );
  }

  // Teacher must be denied on admin users list
  {
    const { response } = await jsonFetch("/api/users", {
      cookie: teacherCookie,
    });
    assert.strictEqual(
      response.status,
      403,
      "teacher should not access /api/users",
    );
  }

  // Teacher should access teachers-by-subject
  {
    const { response } = await jsonFetch(
      "/api/users/teachers/subject/Mathematics",
      { cookie: teacherCookie },
    );
    assert.strictEqual(
      response.status,
      200,
      "teacher should access /api/users/teachers/subject/:subject",
    );
  }

  // Teacher can view student records list
  {
    const { response } = await jsonFetch("/api/students", {
      cookie: teacherCookie,
    });
    assert.strictEqual(
      response.status,
      200,
      "teacher should access /api/students",
    );
  }

  // Teacher must be denied notice publishing
  {
    const { response } = await jsonFetch("/api/notices", {
      method: "POST",
      cookie: teacherCookie,
      body: {
        title: "Blocked teacher notice",
        description: "blocked",
        date: new Date().toISOString().slice(0, 10),
        type: "normal",
        targetAudience: "all",
      },
    });
    assert.strictEqual(
      response.status,
      403,
      "teacher should not create notices",
    );
  }

  // Student opening admin dashboard page should be redirected
  {
    const { response } = await jsonFetch("/admin/dashboard", {
      cookie: studentCookie,
    });
    assert(
      [301, 302, 303, 307, 308].includes(response.status),
      "student /admin/dashboard should redirect",
    );
    const location = response.headers.get("location");
    assert(
      location === "/student/dashboard",
      `student should redirect to /student/dashboard, got ${location}`,
    );
  }

  // Student opening students page should be redirected
  {
    const { response } = await jsonFetch("/students", {
      cookie: studentCookie,
    });
    assert(
      [301, 302, 303, 307, 308].includes(response.status),
      "student /students should redirect",
    );
    const location = response.headers.get("location");
    assert(
      location === "/student/dashboard",
      `student should redirect to /student/dashboard from /students, got ${location}`,
    );
  }

  // Role mismatch login must be rejected
  {
    const { response } = await jsonFetch("/api/auth/login", {
      method: "POST",
      body: {
        email: creds.student.email,
        password: creds.student.password,
        role: "teacher",
      },
    });
    assert.strictEqual(
      response.status,
      403,
      "role mismatch login should be rejected",
    );
  }

  // Optional admin create-user positive check
  if (creds.admin.email && creds.admin.password) {
    const adminCookie = await loginAndGetCookie(creds.admin);
    const unique = Date.now();
    const payload = {
      name: "Smoke Test User",
      email: `smoke.${unique}@school.com`,
      password: "Password1",
      role: "student",
      studentId: `SMK${unique}`,
      class: "10A",
    };
    const { response } = await jsonFetch("/api/users", {
      method: "POST",
      cookie: adminCookie,
      body: payload,
    });
    assert.strictEqual(
      response.status,
      201,
      "admin should be able to create users",
    );
  }

  console.log("[rbac] smoke test passed");
};

run().catch((error) => {
  console.error("[rbac] smoke test failed:", error.message);
  process.exit(1);
});
