const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const XLSX = require("xlsx");
const { rateLimit } = require("express-rate-limit");
const Registration = require("../models/Registration");
const { requireAdmin, requireAdminCsrf } = require("../middleware/requireAdmin");

const router = express.Router();
const publicRegistrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many registration attempts. Please try again later." },
});
const editableFields = [
  "fullName",
  "studentId",
  "email",
  "phone",
  "course",
  "eventRound",
  "semester",
];
const optionalFields = new Set(["eventRound"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9][0-9\s().-]{6,19}$/;

function validateRegistration(input, { partial = false } = {}) {
  const errors = [];
  const values = {};

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { errors: ["A JSON object is required."], values };
  }

  for (const field of Object.keys(input)) {
    if (!editableFields.includes(field)) {
      errors.push(`Unknown field: ${field}.`);
    }
  }

  for (const field of editableFields) {
    if (!Object.hasOwn(input, field)) {
      if (!partial && !optionalFields.has(field)) {
        errors.push(`${field} is required.`);
      }
      continue;
    }

    const rawValue = input[field];
    if (field === "semester") {
      const semester =
        typeof rawValue === "string" && rawValue.trim() !== ""
          ? Number(rawValue)
          : rawValue;
      if (!Number.isInteger(semester) || semester < 1 || semester > 8) {
        errors.push("semester must be a whole number from 1 to 8.");
      } else {
        values.semester = semester;
      }
      continue;
    }

    if (typeof rawValue !== "string") {
      errors.push(`${field} must be text.`);
      continue;
    }

    const value = rawValue.trim();
    if (optionalFields.has(field) && !value) {
      values[field] = "";
      continue;
    }
    const maximumLength =
      field === "fullName" || field === "course" || field === "eventRound"
        ? 100
        : field === "studentId"
          ? 30
          : field === "email"
            ? 254
            : 20;

    if (!value) {
      errors.push(`${field} is required.`);
    } else if (value.length > maximumLength) {
      errors.push(`${field} must be ${maximumLength} characters or fewer.`);
    } else if (field === "studentId" && !/^A\d{11}$/i.test(value)) {
      errors.push("studentId must start with A and be followed by exactly 11 digits.");
    } else if (field === "email" && !emailPattern.test(value)) {
      errors.push("email must be a valid email address.");
    } else if (field === "phone" && !phonePattern.test(value)) {
      errors.push("phone must be a valid phone number.");
    } else {
      values[field] = value;
    }
  }

  return { errors, values };
}

function formatRegistration(registration) {
  return {
    id: registration._id.toString(),
    referenceId: registration.referenceId,
    fullName: registration.fullName,
    studentId: registration.studentId,
    email: registration.email,
    phone: registration.phone,
    course: registration.course,
    eventRound: registration.eventRound || "",
    semester: registration.semester,
    createdAt: registration.createdAt,
    updatedAt: registration.updatedAt,
  };
}

function formatExport(registration) {
  const formatted = formatRegistration(registration);
  const { id, updatedAt, ...exported } = formatted;
  return exported;
}

function handleDatabaseError(error, response, next) {
  if (error.code === 11000 && error.keyPattern?.studentId) {
    return response.status(409).json({
      error: "A registration already exists for this enrollment/student ID.",
    });
  }

  if (error.name === "ValidationError") {
    return response.status(400).json({
      error: "Registration data is invalid.",
      details: Object.values(error.errors).map((item) => item.message),
    });
  }

  return next(error);
}

router.post("/", publicRegistrationLimiter, async (request, response, next) => {
  const { errors, values } = validateRegistration(request.body);
  if (errors.length > 0) {
    return response.status(400).json({
      error: "Please correct the registration details.",
      details: errors,
    });
  }

  try {
    const registration = await Registration.create({
      ...values,
      studentId: values.studentId.toUpperCase(),
      email: values.email.toLowerCase(),
      referenceId: `MTC-${crypto.randomBytes(5).toString("hex").toUpperCase()}`,
    });

    return response.status(201).json({
      message: "Registration successful.",
      registration: { referenceId: registration.referenceId },
    });
  } catch (error) {
    return handleDatabaseError(error, response, next);
  }
});

router.use(requireAdmin);

router.get("/export.json", async (request, response, next) => {
  try {
    const registrations = await Registration.find().sort({ createdAt: -1 }).lean();
    const exportData = registrations.map(formatExport);
    response.setHeader("Content-Disposition", 'attachment; filename="mtc-registrations.json"');
    return response.json({ registrations: exportData });
  } catch (error) {
    return next(error);
  }
});

router.get("/export.xlsx", async (request, response, next) => {
  try {
    const registrations = await Registration.find().sort({ createdAt: -1 }).lean();
    const rows = registrations.map((registration) => ({
      "Reference ID": registration.referenceId,
      "Full Name": registration.fullName,
      "Enrollment/Student ID": registration.studentId,
      Email: registration.email,
      Phone: registration.phone,
      Course: registration.course,
      Semester: registration.semester,
      "Event/Round": registration.eventRound || "",
      "Registration Date": registration.createdAt,
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 20 },
      { wch: 28 },
      { wch: 24 },
      { wch: 32 },
      { wch: 20 },
      { wch: 24 },
      { wch: 12 },
      { wch: 24 },
      { wch: 24 },
    ];
    worksheet["!autofilter"] = { ref: "A1:I1" };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registrations");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    response.setHeader(
      "Content-Disposition",
      'attachment; filename="mtc-registrations.xlsx"',
    );
    return response.send(buffer);
  } catch (error) {
    return next(error);
  }
});

router.get("/", async (request, response, next) => {
  try {
    const registrations = await Registration.find().sort({ createdAt: -1 }).lean();
    return response.json({
      registrations: registrations.map(formatRegistration),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", async (request, response, next) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: "Registration ID is invalid." });
  }

  try {
    const registration = await Registration.findById(request.params.id).lean();
    if (!registration) {
      return response.status(404).json({ error: "Registration not found." });
    }
    return response.json({ registration: formatRegistration(registration) });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", requireAdminCsrf, async (request, response, next) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: "Registration ID is invalid." });
  }

  try {
    const registration = await Registration.findById(request.params.id);
    if (!registration) {
      return response.status(404).json({ error: "Registration not found." });
    }

    const { errors, values } = validateRegistration(request.body, {
      partial: true,
    });
    if (errors.length > 0) {
      return response.status(400).json({
        error: "Please correct the registration details.",
        details: errors,
      });
    }
    if (Object.keys(values).length === 0) {
      return response.status(400).json({
        error: "At least one registration field must be provided.",
      });
    }

    if (values.studentId) {
      values.studentId = values.studentId.toUpperCase();
    }
    if (values.email) {
      values.email = values.email.toLowerCase();
    }

    Object.assign(registration, values);
    await registration.save();
    return response.json({ registration: formatRegistration(registration) });
  } catch (error) {
    return handleDatabaseError(error, response, next);
  }
});

router.delete("/:id", requireAdminCsrf, async (request, response, next) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: "Registration ID is invalid." });
  }

  try {
    const registration = await Registration.findByIdAndDelete(request.params.id);
    if (!registration) {
      return response.status(404).json({ error: "Registration not found." });
    }
    return response.json({ message: "Registration deleted." });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
