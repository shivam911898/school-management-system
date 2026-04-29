const Counter = require("../models/Counter");
const User = require("../models/User");

const DEFAULT_EMAIL_DOMAIN = "jcschool.com";

const getSchoolEmailDomain = () =>
  String(process.env.SCHOOL_EMAIL_DOMAIN || DEFAULT_EMAIL_DOMAIN)
    .trim()
    .toLowerCase();

const getRoleIdentityConfig = (role) => {
  if (role === "student") {
    return {
      counterKey: "student-id-seq",
      prefix: "STU",
      idField: "studentId",
    };
  }

  if (role === "teacher") {
    return {
      counterKey: "teacher-id-seq",
      prefix: "TCH",
      idField: "teacherId",
    };
  }

  throw new Error(`Unsupported role for identity generation: ${role}`);
};

const nextSequence = async (counterKey) => {
  const counter = await Counter.findOneAndUpdate(
    { key: counterKey },
    { $inc: { seq: 1 } },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  return counter.seq;
};

const formatId = (prefix, seq) => `${prefix}${String(seq).padStart(3, "0")}`;

const identityExists = async ({ idField, identity, email }) => {
  const query = {
    $or: [{ [idField]: identity }, { email }],
  };

  // Keep backward compatibility where teacher IDs might have lived in employeeId.
  if (idField === "teacherId") {
    query.$or.push({ employeeId: identity });
  }

  return Boolean(await User.exists(query));
};

const generateUserIdentity = async (role, options = {}) => {
  const { maxRetries = 50 } = options;
  const config = getRoleIdentityConfig(role);
  const domain = getSchoolEmailDomain();

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const seq = await nextSequence(config.counterKey);
    const identity = formatId(config.prefix, seq);
    const email = `${identity.toLowerCase()}@${domain}`;

    const exists = await identityExists({
      idField: config.idField,
      identity,
      email,
    });

    if (!exists) {
      return {
        idField: config.idField,
        identity,
        email,
      };
    }
  }

  throw new Error(
    `Failed to generate unique ${role} identity after ${maxRetries} attempts`,
  );
};

module.exports = {
  generateUserIdentity,
  getSchoolEmailDomain,
};
